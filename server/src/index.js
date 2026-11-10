// Waldläufer-Vermittlungs-Server (Cloudflare Worker)
//
// Die App fragt Routen und Orte hier an statt direkt bei openrouteservice. Der Worker
//  - hängt den geheimen openrouteservice-Schlüssel an (Secret ORS_API_KEY, nie in der App),
//  - lässt nur die Anfragen durch, die die App wirklich braucht (Rundkurse zu Fuß, Ortssuche),
//  - begrenzt je Gerät (pro Minute und Suchen pro Tag) und insgesamt,
//  - speichert gleiche Anfragen zwischen (spart Kontingent),
//  - hält eine Reserve zurück, damit laufende Suchen fertig werden, und meldet das freundlich,
//  - kann per Einstellung auf einen anderen openrouteservice-Server umgestellt werden (ORS_BASE).
//
// Endpunkte:
//   GET  /health                           → Lebenszeichen + optionale Statusmeldung für die App
//   GET  /status                           → Kontingent und Nutzung heute (für die Frühwarnung)
//   POST /route/{foot-hiking|foot-walking}   → Rundkurs (Body wie openrouteservice /v2/directions/{profil}/geojson)
//   GET  /geocode/{autocomplete|search}?text=…
//
// Köpfe der App: X-Install-Id (zufällige Geräte-ID), X-Search-Id (eine ID je Suche, für das Tageslimit).
//
// Einstellungen (wrangler.toml [vars] bzw. GitHub-Variablen, siehe server-deploy.yml):
//   ORS_BASE        Adresse des Routing-Servers (Standard: öffentliches openrouteservice von HeiGIT)
//   PELIAS_BASE     Adresse der Ortssuche (Standard: HeiGIT)
//   DAILY_SEARCHES  Suchen pro Gerät und Tag (Standard 10, 0 = unbegrenzt)
//   BUSY_RESERVE    so viele Anfragen bleiben im Tageskontingent für bereits laufende Suchen (Standard 60)
//   STATUS_MESSAGE  Hinweis, den die App beim Start anzeigt (z. B. bei Störungen); leer = keiner

import { DurableObject } from "cloudflare:workers";

const DEFAULT_ORS = "https://api.heigit.org/openrouteservice";
const DEFAULT_PELIAS = "https://api.heigit.org/pelias/v1";
const PROFILES = new Set(["foot-hiking", "foot-walking"]);
const EXTRA_INFO = new Set(["waytype", "surface", "green", "steepness", "noise"]);
const WEIGHTINGS = new Set(["green", "quiet", "shadow"]);
const MAX_ROUND_TRIP_M = 45000;
const MAX_BODY = 20000;
const CACHE_DAYS = 7;
const CACHE_MAX_BYTES = 1500000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Install-Id, X-Search-Id",
  "Access-Control-Expose-Headers": "X-Cache, x-ratelimit-remaining, x-ratelimit-reset, Retry-After",
  "Access-Control-Max-Age": "86400"
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra } });
}
// Fehler im Format von openrouteservice (error.message), ergänzt um einen Grund für freundliche Meldungen
function err(status, message, reason, retryAfter) {
  const e = { message };
  if (reason) e.reason = reason;
  if (retryAfter) e.retryAfter = retryAfter;
  return json({ error: e }, status, retryAfter ? { "Retry-After": String(retryAfter) } : {});
}

async function allowed(limiter, key) {
  if (!limiter) return true;
  try { return (await limiter.limit({ key })).success; } catch { return true; }
}

function num(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
const today = () => new Date().toISOString().slice(0, 10);
const secondsToMidnightUTC = () => { const d = new Date(); return Math.max(60, Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - d) / 1000)); };
const base = (v, d) => String(v || d).replace(/\/+$/, "");

// Nur bekannte, harmlose Felder weitergeben. Startpunkt auf ~1 m und Länge auf 100 m gerundet,
// damit gleiche Suchen gleich aussehen und aus dem Zwischenspeicher kommen können.
export function cleanRouteBody(b) {
  if (!b || typeof b !== "object") return null;
  const c = Array.isArray(b.coordinates) ? b.coordinates : null;
  if (!c || c.length !== 1 || !Array.isArray(c[0]) || c[0].length !== 2) return null;
  const lng = num(c[0][0], -180, 180), lat = num(c[0][1], -90, 90);
  if (lng === null || lat === null) return null;
  const rt = b.options && b.options.round_trip;
  if (!rt) return null;
  const length = num(rt.length, 500, MAX_ROUND_TRIP_M);
  const points = num(rt.points ?? 3, 2, 30);
  const seed = num(rt.seed ?? 0, 0, 1e9);
  if (length === null || points === null || seed === null) return null;
  const r5 = v => Math.round(v * 1e5) / 1e5;
  const options = { round_trip: { length: Math.round(length / 100) * 100, points: Math.round(points), seed: Math.round(seed) } };
  const w = b.options.profile_params && b.options.profile_params.weightings;
  if (w && typeof w === "object") {
    const ww = {};
    for (const k of Object.keys(w).sort()) if (WEIGHTINGS.has(k)) { const v = num(w[k], 0, 1); if (v !== null) ww[k] = v; }
    if (Object.keys(ww).length) options.profile_params = { weightings: ww };
  }
  const out = {
    coordinates: [[r5(lng), r5(lat)]],
    options,
    elevation: b.elevation === true,
    instructions: b.instructions !== false,
    language: typeof b.language === "string" && /^[a-z]{2}(-[a-z]{2})?$/i.test(b.language) ? b.language.toLowerCase() : "de",
    units: "m"
  };
  if (Array.isArray(b.extra_info)) {
    const ex = [...new Set(b.extra_info.filter(x => EXTRA_INFO.has(x)))].sort();
    if (ex.length) out.extra_info = ex;
  }
  return out;
}

async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function zentrale(env) {
  if (!env.ZENTRALE) return null;
  try { return env.ZENTRALE.getByName ? env.ZENTRALE.getByName("zentrale") : env.ZENTRALE.get(env.ZENTRALE.idFromName("zentrale")); }
  catch { return null; }
}
async function safe(p, fallback) { try { return await p; } catch { return fallback; } }

// ---------------------------------------------------------------------------------------------
// Zentrale: ein Durable Object mit SQLite – merkt sich Suchen je Gerät, Kontingent, Zwischenspeicher.
// ---------------------------------------------------------------------------------------------
export class Zentrale extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS searches (day TEXT, install TEXT, sid TEXT, PRIMARY KEY (day, install, sid))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, body TEXT, ct TEXT, ts INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS counters (day TEXT, k TEXT, n INTEGER, PRIMARY KEY (day, k))`);
  }
  _meta(k) { const r = this.sql.exec(`SELECT v FROM meta WHERE k = ?`, k).toArray(); return r.length ? r[0].v : null; }
  _setMeta(k, v) { this.sql.exec(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, String(v)); }
  _count(k, by = 1) { this.sql.exec(`INSERT INTO counters (day, k, n) VALUES (?, ?, ?) ON CONFLICT(day, k) DO UPDATE SET n = n + excluded.n`, today(), k, by); }
  _cleanup() {
    const day = today();
    if (this._meta("cleaned") === day) return;
    const keep = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    this.sql.exec(`DELETE FROM searches WHERE day < ?`, day);
    this.sql.exec(`DELETE FROM counters WHERE day < ?`, keep);
    this.sql.exec(`DELETE FROM cache WHERE ts < ?`, Date.now() - CACHE_DAYS * 864e5);
    this._setMeta("cleaned", day);
  }

  // Darf diese Suche (neu oder schon laufend) weiterlaufen?
  // → { ok, reason?, retryAfter?, count }
  beginSearch(install, sid, dailyLimit, reserve) {
    this._cleanup();
    const day = today();
    const known = this.sql.exec(`SELECT 1 FROM searches WHERE day = ? AND install = ? AND sid = ?`, day, install, sid).toArray().length > 0;
    const count = this.sql.exec(`SELECT COUNT(*) AS n FROM searches WHERE day = ? AND install = ?`, day, install).one().n;
    if (known) return { ok: true, count };
    // Kontingent erschöpft oder nur noch Reserve? Dann keine NEUEN Suchen.
    const exhaustedUntil = Number(this._meta("exhaustedUntil") || 0);
    if (exhaustedUntil > Date.now()) return { ok: false, reason: "busy", retryAfter: Math.round((exhaustedUntil - Date.now()) / 1000), count };
    const remaining = this._meta("remaining"), remDay = this._meta("remainingDay");
    if (remaining !== null && remDay === day && Number(remaining) <= reserve) {
      const reset = Number(this._meta("reset") || 0);
      return { ok: false, reason: "busy", retryAfter: reset > Date.now() ? Math.round((reset - Date.now()) / 1000) : 3600, count };
    }
    if (dailyLimit > 0 && count >= dailyLimit) return { ok: false, reason: "device-daily", count };
    this.sql.exec(`INSERT INTO searches (day, install, sid) VALUES (?, ?, ?)`, day, install, sid);
    this._count("searches");
    return { ok: true, count: count + 1 };
  }

  // Kontingent-Angaben aus den Antwort-Köpfen von openrouteservice merken
  noteQuota(remaining, resetMs, limit, exhausted) {
    const day = today();
    if (remaining !== null && remaining !== undefined && remaining !== "") { this._setMeta("remaining", remaining); this._setMeta("remainingDay", day); }
    if (resetMs) this._setMeta("reset", resetMs);
    if (limit) this._setMeta("limit", limit);
    if (exhausted) this._setMeta("exhaustedUntil", resetMs && resetMs > Date.now() ? resetMs : Date.now() + 60 * 60 * 1000);
    this._count(exhausted ? "quotaErrors" : "upstream");
  }

  cacheGet(k) {
    const r = this.sql.exec(`SELECT body, ct, ts FROM cache WHERE k = ?`, k).toArray();
    if (!r.length || r[0].ts < Date.now() - CACHE_DAYS * 864e5) return null;
    this._count("cacheHits");
    return { body: r[0].body, ct: r[0].ct };
  }
  cachePut(k, body, ct) {
    if (!body || body.length > CACHE_MAX_BYTES) return false;
    this.sql.exec(`INSERT INTO cache (k, body, ct, ts) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET body = excluded.body, ct = excluded.ct, ts = excluded.ts`, k, body, ct, Date.now());
    return true;
  }

  status() {
    const day = today();
    const c = {}; for (const r of this.sql.exec(`SELECT k, n FROM counters WHERE day = ?`, day).toArray()) c[r.k] = r.n;
    const devices = this.sql.exec(`SELECT COUNT(DISTINCT install) AS n FROM searches WHERE day = ?`, day).one().n;
    const remDay = this._meta("remainingDay");
    return {
      day,
      remaining: remDay === day && this._meta("remaining") !== null ? Number(this._meta("remaining")) : null,
      limit: this._meta("limit") !== null ? Number(this._meta("limit")) : null,
      reset: this._meta("reset") ? new Date(Number(this._meta("reset"))).toISOString() : null,
      exhaustedUntil: Number(this._meta("exhaustedUntil") || 0) > Date.now() ? new Date(Number(this._meta("exhaustedUntil"))).toISOString() : null,
      searchesToday: c.searches || 0,
      devicesToday: devices,
      upstreamRequestsToday: c.upstream || 0,
      cacheHitsToday: c.cacheHits || 0,
      quotaErrorsToday: c.quotaErrors || 0,
      cachedRoutes: this.sql.exec(`SELECT COUNT(*) AS n FROM cache`).one().n
    };
  }
}

// ---------------------------------------------------------------------------------------------

function quotaFromHeaders(h) {
  const remaining = h.get("x-ratelimit-remaining");
  const reset = h.get("x-ratelimit-reset");
  const limit = h.get("x-ratelimit-limit");
  let resetMs = null;
  if (reset && /^\d+$/.test(reset)) { const n = Number(reset); resetMs = n < 1e11 ? n * 1000 : n; }
  return { remaining: remaining !== null && /^\d+$/.test(remaining) ? Number(remaining) : null, resetMs, limit: limit && /^\d+$/.test(limit) ? Number(limit) : null };
}

function respond(body, status, ct, upstreamHeaders, extra = {}) {
  const headers = { "Content-Type": ct || "application/json", ...CORS, ...extra };
  if (upstreamHeaders) for (const h of ["x-ratelimit-remaining", "x-ratelimit-reset", "x-ratelimit-limit"]) {
    const v = upstreamHeaders.get(h); if (v !== null) headers[h] = v;
  }
  return new Response(body, { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/" || url.pathname === "/health") {
      const msg = String(env.STATUS_MESSAGE || "").trim();
      return json(msg ? { ok: true, name: "waldlaeufer-api", message: msg } : { ok: true, name: "waldlaeufer-api" });
    }
    const Z = zentrale(env);
    if (url.pathname === "/status") {
      const s = Z ? await safe(Z.status(), null) : null;
      return json({ ok: true, upstream: base(env.ORS_BASE, DEFAULT_ORS).replace(/^https?:\/\//, "").split("/")[0], dailySearchesPerDevice: Number(env.DAILY_SEARCHES ?? 10), ...(s || {}) });
    }

    const ORS = base(env.ORS_BASE, DEFAULT_ORS), PELIAS = base(env.PELIAS_BASE, DEFAULT_PELIAS);
    const usesHeigit = ORS.includes("api.heigit.org") || PELIAS.includes("api.heigit.org");
    if (usesHeigit && !env.ORS_API_KEY) return err(500, "Server nicht eingerichtet (ORS_API_KEY fehlt)");
    const auth = env.ORS_API_KEY ? { "Authorization": env.ORS_API_KEY } : {};

    const install = request.headers.get("X-Install-Id") || "";
    if (!/^[A-Za-z0-9-]{8,64}$/.test(install)) return err(400, "X-Install-Id fehlt");

    // ---------- Rundkurs ----------
    let m = url.pathname.match(/^\/route\/([a-z-]+)$/);
    if (m) {
      if (request.method !== "POST") return err(405, "Nur POST");
      if (!PROFILES.has(m[1])) return err(400, "Unbekanntes Profil");
      if (!(await allowed(env.RL_DEVICE, "route:" + install))) return err(429, "Rate limit exceeded (Waldläufer-Server, Gerät)", "device-minute", 60);
      const text = await request.text();
      if (text.length > MAX_BODY) return err(413, "Anfrage zu groß");
      let body; try { body = JSON.parse(text); } catch { return err(400, "Ungültiges JSON"); }
      const clean = cleanRouteBody(body);
      if (!clean) return err(400, "Ungültige Rundkurs-Anfrage");

      // Tageslimit je Gerät und Reserve – gezählt werden Suchen, nicht einzelne Anfragen
      const sid = (request.headers.get("X-Search-Id") || "").slice(0, 64);
      if (Z && /^[A-Za-z0-9-]{4,64}$/.test(sid)) {
        const daily = Number(env.DAILY_SEARCHES ?? 10), reserve = Number(env.BUSY_RESERVE ?? 60);
        const g = await safe(Z.beginSearch(install, sid, daily, reserve), { ok: true });
        if (!g.ok && g.reason === "device-daily")
          return err(429, `Tageslimit erreicht: ${daily} Suchen pro Tag`, "device-daily", secondsToMidnightUTC());
        if (!g.ok && g.reason === "busy")
          return err(429, "Gerade sehr viele Anfragen – neue Suchen später wieder möglich", "busy", g.retryAfter || 3600);
      }

      // Zwischenspeicher
      const bodyText = JSON.stringify(clean);
      const key = Z ? await sha256(m[1] + "|" + ORS + "|" + bodyText) : null;
      if (Z) {
        const hit = await safe(Z.cacheGet(key), null);
        if (hit) return respond(hit.body, 200, hit.ct, null, { "X-Cache": "HIT" });
      }

      if (!(await allowed(env.RL_TOTAL, "route:all"))) return err(429, "Rate limit exceeded (Waldläufer-Server, gesamt)", "total-minute", 60);
      const upstream = await fetch(`${ORS}/v2/directions/${m[1]}/geojson`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json", "Accept": "application/geo+json, application/json" },
        body: bodyText
      });
      const out = await upstream.text();
      const ct = upstream.headers.get("Content-Type") || "application/json";
      if (Z) {
        const q = quotaFromHeaders(upstream.headers);
        const exhausted = upstream.status === 403 && /quota/i.test(out);
        await safe(Z.noteQuota(q.remaining, q.resetMs, q.limit, exhausted), null);
        if (exhausted) return err(429, "Gerade sehr viele Anfragen – neue Suchen später wieder möglich", "busy", q.resetMs ? Math.round((q.resetMs - Date.now()) / 1000) : 3600);
        if (upstream.ok) await safe(Z.cachePut(key, out, ct), null);
      }
      return respond(out, upstream.status, ct, upstream.headers, { "X-Cache": "MISS" });
    }

    // ---------- Ortssuche ----------
    m = url.pathname.match(/^\/geocode\/(autocomplete|search)$/);
    if (m) {
      if (request.method !== "GET") return err(405, "Nur GET");
      if (!(await allowed(env.RL_DEVICE, "geo:" + install))) return err(429, "Rate limit exceeded (Waldläufer-Server, Gerät)", "device-minute", 60);
      const text = (url.searchParams.get("text") || "").trim();
      if (!text || text.length > 200) return err(400, "Suchtext fehlt oder zu lang");
      const q = new URLSearchParams({ text, size: String(num(url.searchParams.get("size"), 1, 10) ?? 7), lang: (url.searchParams.get("lang") || "de").slice(0, 5) });
      const lat = num(url.searchParams.get("focus.point.lat"), -90, 90), lon = num(url.searchParams.get("focus.point.lon"), -180, 180);
      if (lat !== null && lon !== null) { q.set("focus.point.lat", String(lat)); q.set("focus.point.lon", String(lon)); }
      if (env.ORS_API_KEY) q.set("api_key", env.ORS_API_KEY);
      const upstream = await fetch(`${PELIAS}/${m[1]}?${q}`, { headers: { ...auth, "Accept": "application/json" } });
      return respond(upstream.body, upstream.status, upstream.headers.get("Content-Type"), upstream.headers);
    }

    return err(404, "Nicht gefunden");
  }
};
