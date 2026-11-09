// Waldläufer-Vermittlungs-Server (Cloudflare Worker)
//
// Die App fragt Routen und Orte hier an statt direkt bei openrouteservice. Der Worker
//  - hängt den geheimen openrouteservice-Schlüssel an (Secret ORS_API_KEY, nie in der App),
//  - lässt nur die Anfragen durch, die die App wirklich braucht (Rundkurse zu Fuß, Ortssuche),
//  - begrenzt die Anfragen je Gerät und insgesamt, damit das Kontingent nicht leergeräumt wird.
//
// Endpunkte:
//   GET  /health                         → Lebenszeichen
//   POST /route/{foot-hiking|foot-walking} → Rundkurs (Body wie openrouteservice /v2/directions/{profil}/geojson)
//   GET  /geocode/{autocomplete|search}?text=…&focus.point.lat=…&focus.point.lon=…&size=…&lang=…
//
// Jede Anfrage (außer /health) braucht den Kopf X-Install-Id (zufällige ID, die die App einmalig erzeugt).

const ORS = "https://api.heigit.org/openrouteservice";
const PELIAS = "https://api.heigit.org/pelias/v1";
const PROFILES = new Set(["foot-hiking", "foot-walking"]);
const EXTRA_INFO = new Set(["waytype", "surface", "green", "steepness", "noise"]);
const WEIGHTINGS = new Set(["green", "quiet", "shadow"]);
const MAX_ROUND_TRIP_M = 45000;   // längste Runde, die angefragt werden darf
const MAX_BODY = 20000;           // Bytes

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Install-Id",
  "Access-Control-Max-Age": "86400"
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra } });
}
// Fehler im selben Format wie openrouteservice, damit die App sie wie gewohnt auswertet
function err(status, message) { return json({ error: { message } }, status); }

async function allowed(limiter, key) {
  if (!limiter) return true;               // Bindung nicht vorhanden → nicht begrenzen
  try { return (await limiter.limit({ key })).success; } catch { return true; }
}

function num(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// Nur bekannte, harmlose Felder an openrouteservice weitergeben
function cleanRouteBody(b) {
  if (!b || typeof b !== "object") return null;
  const c = Array.isArray(b.coordinates) ? b.coordinates : null;
  if (!c || c.length !== 1 || !Array.isArray(c[0]) || c[0].length !== 2) return null;   // Rundkurs: genau 1 Startpunkt
  const lng = num(c[0][0], -180, 180), lat = num(c[0][1], -90, 90);
  if (lng === null || lat === null) return null;
  const rt = b.options && b.options.round_trip;
  if (!rt) return null;
  const length = num(rt.length, 500, MAX_ROUND_TRIP_M);
  const points = num(rt.points ?? 3, 2, 30);
  const seed = num(rt.seed ?? 0, 0, 1e9);
  if (length === null || points === null || seed === null) return null;
  const options = { round_trip: { length: Math.round(length), points: Math.round(points), seed: Math.round(seed) } };
  const w = b.options.profile_params && b.options.profile_params.weightings;
  if (w && typeof w === "object") {
    const ww = {};
    for (const k of Object.keys(w)) if (WEIGHTINGS.has(k)) { const v = num(w[k], 0, 1); if (v !== null) ww[k] = v; }
    if (Object.keys(ww).length) options.profile_params = { weightings: ww };
  }
  const out = {
    coordinates: [[lng, lat]],
    options,
    elevation: b.elevation === true,
    instructions: b.instructions !== false,
    language: typeof b.language === "string" && /^[a-z]{2}(-[a-z]{2})?$/i.test(b.language) ? b.language : "de",
    units: "m"
  };
  if (Array.isArray(b.extra_info)) {
    const ex = b.extra_info.filter(x => EXTRA_INFO.has(x));
    if (ex.length) out.extra_info = ex;
  }
  return out;
}

async function passThrough(upstream) {
  const headers = { "Content-Type": upstream.headers.get("Content-Type") || "application/json", ...CORS };
  for (const h of ["x-ratelimit-remaining", "x-ratelimit-reset", "x-ratelimit-limit"]) {
    const v = upstream.headers.get(h); if (v !== null) headers[h] = v;
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, name: "waldlaeufer-api" });
    if (!env.ORS_API_KEY) return err(500, "Server nicht eingerichtet (ORS_API_KEY fehlt)");

    const install = request.headers.get("X-Install-Id") || "";
    if (!/^[A-Za-z0-9-]{8,64}$/.test(install)) return err(400, "X-Install-Id fehlt");

    // ---------- Rundkurs ----------
    let m = url.pathname.match(/^\/route\/([a-z-]+)$/);
    if (m) {
      if (request.method !== "POST") return err(405, "Nur POST");
      if (!PROFILES.has(m[1])) return err(400, "Unbekanntes Profil");
      if (!(await allowed(env.RL_DEVICE, "route:" + install))) return err(429, "Rate limit exceeded (Waldläufer-Server, Gerät)");
      if (!(await allowed(env.RL_TOTAL, "route:all"))) return err(429, "Rate limit exceeded (Waldläufer-Server, gesamt)");
      const text = await request.text();
      if (text.length > MAX_BODY) return err(413, "Anfrage zu groß");
      let body; try { body = JSON.parse(text); } catch { return err(400, "Ungültiges JSON"); }
      const clean = cleanRouteBody(body);
      if (!clean) return err(400, "Ungültige Rundkurs-Anfrage");
      const upstream = await fetch(`${ORS}/v2/directions/${m[1]}/geojson`, {
        method: "POST",
        headers: { "Authorization": env.ORS_API_KEY, "Content-Type": "application/json", "Accept": "application/geo+json, application/json" },
        body: JSON.stringify(clean)
      });
      return passThrough(upstream);
    }

    // ---------- Ortssuche ----------
    m = url.pathname.match(/^\/geocode\/(autocomplete|search)$/);
    if (m) {
      if (request.method !== "GET") return err(405, "Nur GET");
      if (!(await allowed(env.RL_DEVICE, "geo:" + install))) return err(429, "Rate limit exceeded (Waldläufer-Server, Gerät)");
      const text = (url.searchParams.get("text") || "").trim();
      if (!text || text.length > 200) return err(400, "Suchtext fehlt oder zu lang");
      const q = new URLSearchParams({ text, size: String(num(url.searchParams.get("size"), 1, 10) ?? 7), lang: (url.searchParams.get("lang") || "de").slice(0, 5) });
      const lat = num(url.searchParams.get("focus.point.lat"), -90, 90), lon = num(url.searchParams.get("focus.point.lon"), -180, 180);
      if (lat !== null && lon !== null) { q.set("focus.point.lat", String(lat)); q.set("focus.point.lon", String(lon)); }
      q.set("api_key", env.ORS_API_KEY);
      const upstream = await fetch(`${PELIAS}/${m[1]}?${q}`, { headers: { "Authorization": env.ORS_API_KEY, "Accept": "application/json" } });
      return passThrough(upstream);
    }

    return err(404, "Nicht gefunden");
  }
};

export { cleanRouteBody };
