// Tests für den Vermittlungs-Server – Node 22, ohne Zusatzpakete:
//   node --import ./server/test/setup.mjs --test server/test/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import worker, { Zentrale } from "../src/index.js";
import { fakeCtx } from "./sqlite-fake.mjs";

// ---------- Attrappe für openrouteservice ----------
const calls = [];
let upstreamMode = "ok", remaining = 1999;
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  const h = { "Content-Type": "application/json", "x-ratelimit-remaining": String(remaining), "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600), "x-ratelimit-limit": "2000" };
  if (upstreamMode === "quota") return new Response('{"error":"Quota exceeded"}', { status: 403, headers: h });
  return new Response(JSON.stringify({ ok: "upstream", url: String(url), n: calls.length }), { status: 200, headers: h });
};
function limiter(max) {
  const n = new Map();
  return { async limit({ key }) { const c = (n.get(key) || 0) + 1; n.set(key, c); return { success: c <= max }; } };
}
function zentraleNS() {
  const z = new Zentrale(fakeCtx(), {});
  return { getByName: () => z, _z: z };
}
const env = (extra = {}) => ({ ORS_API_KEY: "GEHEIM", RL_DEVICE: limiter(30), RL_TOTAL: limiter(38), ZENTRALE: zentraleNS(), DAILY_SEARCHES: "10", BUSY_RESERVE: "60", ...extra });
const ID = { "X-Install-Id": "3f2a9c1e-1111-4a2b-9c3d-abcdefabcdef" };
const body = (seed = 42, extra = {}) => ({
  coordinates: [[11.0712345678, 49.4512345678]],
  options: { round_trip: { length: 8040, points: 5, seed }, profile_params: { weightings: { quiet: 0.3, green: 1, evil: 5 } }, avoid_features: ["x"] },
  elevation: true, extra_info: ["surface", "waytype", "green", "osmid"], instructions: true, language: "de", units: "m",
  api_key: "client-should-not-pass", ...extra
});
const post = (path, b, e, headers = ID) =>
  worker.fetch(new Request("https://w.example" + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof b === "string" ? b : JSON.stringify(b) }), e);
const get = (path, e, headers = ID) => worker.fetch(new Request("https://w.example" + path, { headers }), e);
const search = (sid, seed, e, install = ID["X-Install-Id"]) => post("/route/foot-hiking", body(seed), e, { "X-Install-Id": install, "X-Search-Id": sid });

// ---------- Grundfunktionen ----------
test("health ohne Geräte-ID, mit optionaler Statusmeldung", async () => {
  assert.deepEqual(await (await get("/health", env(), {})).json(), { ok: true, name: "waldlaeufer-api" });
  const j = await (await get("/health", env({ STATUS_MESSAGE: "Wartung heute Abend" }), {})).json();
  assert.equal(j.message, "Wartung heute Abend");
});

test("Rundkurs: geheimer Schlüssel, bereinigter und gerundeter Inhalt", async () => {
  calls.length = 0; upstreamMode = "ok";
  const r = await post("/route/foot-hiking", body(), env());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("X-Cache"), "MISS");
  const c = calls[0];
  assert.equal(c.url, "https://api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson");
  assert.equal(c.init.headers.Authorization, "GEHEIM");
  const sent = JSON.parse(c.init.body);
  assert.deepEqual(sent.coordinates, [[11.07123, 49.45123]]);
  assert.deepEqual(sent.options.round_trip, { length: 8000, points: 5, seed: 42 });
  assert.deepEqual(sent.options.profile_params.weightings, { green: 1, quiet: 0.3 });
  assert.deepEqual(sent.extra_info, ["green", "surface", "waytype"]);
  assert.equal(sent.api_key, undefined);
  assert.equal(sent.options.avoid_features, undefined);
});

test("ungültige Anfragen gehen nicht an openrouteservice", async () => {
  calls.length = 0; const e = env();
  assert.equal((await post("/route/driving-car", body(), e)).status, 400);
  assert.equal((await post("/route/foot-hiking", { ...body(), options: { round_trip: { length: 900000 } } }, e)).status, 400);
  assert.equal((await post("/route/foot-hiking", { ...body(), coordinates: [[1, 2], [3, 4]] }, e)).status, 400);
  assert.equal((await post("/route/foot-hiking", "kein json", e)).status, 400);
  assert.equal((await post("/route/foot-hiking", "x".repeat(30000), e)).status, 413);
  assert.equal((await post("/route/foot-hiking", body(), e, {})).status, 400);
  assert.equal((await get("/route/foot-hiking", e)).status, 405);
  assert.equal((await get("/v2/directions/foot-hiking", e)).status, 404);
  assert.equal(calls.length, 0);
});

test("Limit je Gerät pro Minute → 429 mit Grund", async () => {
  const e = env({ ZENTRALE: undefined });
  for (let i = 0; i < 30; i++) assert.equal((await post("/route/foot-hiking", body(i), e)).status, 200);
  const r = await post("/route/foot-hiking", body(99), e);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error.reason, "device-minute");
  assert.equal((await post("/route/foot-hiking", body(1), e, { "X-Install-Id": "anderes-geraet-1234" })).status, 200);
});

test("Gesamtlimit pro Minute greift über alle Geräte", async () => {
  const e = env({ ZENTRALE: undefined });
  let ok = 0, blocked = 0;
  for (let i = 0; i < 45; i++) {
    const r = await post("/route/foot-walking", body(i), e, { "X-Install-Id": "geraet-" + String(i).padStart(4, "0") });
    r.status === 200 ? ok++ : blocked++;
  }
  assert.equal(ok, 38); assert.equal(blocked, 7);
});

// ---------- Notfall-Funktionen ----------
test("Zwischenspeicher: gleiche Anfrage kommt beim zweiten Mal ohne openrouteservice", async () => {
  calls.length = 0; upstreamMode = "ok"; const e = env();
  const a = await post("/route/foot-hiking", body(7), e);
  const b = await post("/route/foot-hiking", body(7), e, { "X-Install-Id": "ganz-anderes-geraet" });
  assert.equal(a.headers.get("X-Cache"), "MISS");
  assert.equal(b.headers.get("X-Cache"), "HIT");
  assert.equal(await a.text(), await b.text());
  assert.equal(calls.length, 1, "nur eine echte Anfrage");
  // andere Saat → neue Anfrage
  assert.equal((await post("/route/foot-hiking", body(8), e)).headers.get("X-Cache"), "MISS");
  assert.equal(calls.length, 2);
});

test("Tageslimit je Gerät zählt Suchen (nicht Einzelanfragen) und meldet freundlich", async () => {
  upstreamMode = "ok"; const e = env({ DAILY_SEARCHES: "3", RL_DEVICE: limiter(1000) });
  for (let s = 1; s <= 3; s++) for (let k = 0; k < 5; k++) assert.equal((await search("suche-" + s, s * 100 + k, e)).status, 200, `Suche ${s}, Anfrage ${k}`);
  const r = await search("suche-4", 999, e);
  assert.equal(r.status, 429);
  const j = (await r.json()).error;
  assert.equal(j.reason, "device-daily");
  assert.ok(j.retryAfter > 0);
  // eine bereits begonnene Suche darf weiterlaufen
  assert.equal((await search("suche-3", 3333, e)).status, 200);
  // anderes Gerät nicht betroffen
  assert.equal((await search("suche-1", 4444, e, "zweites-geraet-1")).status, 200);
});

test("Reserve: bei knappem Kontingent keine NEUEN Suchen, laufende werden fertig", async () => {
  upstreamMode = "ok"; remaining = 50; const e = env({ BUSY_RESERVE: "60", RL_DEVICE: limiter(1000) });
  assert.equal((await search("laeuft-1", 1, e)).status, 200);           // erste Suche: Kontingent noch unbekannt
  assert.equal((await search("laeuft-1", 2, e)).status, 200);           // gleiche Suche läuft weiter
  const r = await search("neu-2", 3, e, "anderes-geraet-55");
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error.reason, "busy");
  remaining = 1999;
});

test("Kontingent erschöpft (403 Quota) → freundliche 'busy'-Meldung, danach keine neuen Suchen", async () => {
  remaining = 1999; upstreamMode = "quota"; const e = env({ RL_DEVICE: limiter(1000) });
  const r = await search("suche-s1", 1, e);
  assert.equal(r.status, 429);
  const j = (await r.json()).error;
  assert.equal(j.reason, "busy"); assert.ok(j.retryAfter > 0);
  upstreamMode = "ok"; calls.length = 0;
  const r2 = await search("suche-s2", 2, e, "noch-ein-geraet-1");
  assert.equal(r2.status, 429);
  assert.equal(calls.length, 0, "keine Anfrage an openrouteservice, solange erschöpft");
});

test("Umschalten auf eigenen Routing-Server (ORS_BASE) – ohne Schlüssel möglich", async () => {
  upstreamMode = "ok"; calls.length = 0;
  const e = env({ ORS_BASE: "https://ors.example.de/ors/", ORS_API_KEY: "" , PELIAS_BASE: "https://pelias.example.de/v1" });
  const r = await post("/route/foot-walking", body(5), e);
  assert.equal(r.status, 200);
  assert.equal(calls[0].url, "https://ors.example.de/ors/v2/directions/foot-walking/geojson");
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test("Status für die Frühwarnung", async () => {
  upstreamMode = "ok"; remaining = 321; const e = env({ RL_DEVICE: limiter(1000) });
  await search("suche-a1", 1, e); await search("suche-a1", 2, e); await search("suche-b1", 3, e, "geraet-zwei-22");
  await post("/route/foot-hiking", body(1), e);   // Zwischenspeicher-Treffer
  const s = await (await get("/status", e, {})).json();
  assert.equal(s.remaining, 321); assert.equal(s.limit, 2000);
  assert.equal(s.searchesToday, 2); assert.equal(s.devicesToday, 2);
  assert.equal(s.upstreamRequestsToday, 3); assert.equal(s.cacheHitsToday, 1);
  assert.equal(s.upstream, "api.heigit.org");
  remaining = 1999;
});

test("Ortssuche: Schlüssel vom Server, Parameter geprüft", async () => {
  calls.length = 0;
  const r = await get("/geocode/search?text=Hauptstra%C3%9Fe%205&size=99&lang=de&focus.point.lat=49.5&focus.point.lon=11.2&api_key=fremd", env());
  assert.equal(r.status, 200);
  const u = new URL(calls[0].url);
  assert.equal(u.origin + u.pathname, "https://api.heigit.org/pelias/v1/search");
  assert.equal(u.searchParams.get("api_key"), "GEHEIM");
  assert.equal(u.searchParams.get("size"), "7");
  assert.equal((await get("/geocode/search?text=", env())).status, 400);
});

test("ohne Schlüssel bei HeiGIT: klare Meldung; ohne Bindungen läuft es trotzdem", async () => {
  assert.equal((await post("/route/foot-hiking", body(), { RL_DEVICE: limiter(30) })).status, 500);
  assert.equal((await post("/route/foot-hiking", body(), { ORS_API_KEY: "GEHEIM" })).status, 200);
});
