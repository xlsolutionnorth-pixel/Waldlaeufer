// Tests für den Vermittlungs-Server – laufen mit Node 22 ohne Zusatzpakete: node --test server/test/
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  return new Response(JSON.stringify({ ok: "upstream", url: String(url) }), {
    status: 200, headers: { "Content-Type": "application/json", "x-ratelimit-remaining": "1999" }
  });
};
function limiter(max) {
  const n = new Map();
  return { async limit({ key }) { const c = (n.get(key) || 0) + 1; n.set(key, c); return { success: c <= max }; } };
}
const env = () => ({ ORS_API_KEY: "GEHEIM", RL_DEVICE: limiter(30), RL_TOTAL: limiter(38) });
const ID = { "X-Install-Id": "3f2a9c1e-1111-4a2b-9c3d-abcdefabcdef" };
const goodBody = {
  coordinates: [[11.07, 49.45]],
  options: { round_trip: { length: 8000, points: 5, seed: 42 }, profile_params: { weightings: { green: 1, quiet: 0.3, evil: 5 } }, avoid_features: ["x"] },
  elevation: true, extra_info: ["waytype", "surface", "green", "osmid"], instructions: true, language: "de", units: "m",
  api_key: "client-should-not-pass", geometry_simplify: true
};
const post = (path, body, e = env(), headers = ID) =>
  worker.fetch(new Request("https://w.example" + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), e);
const get = (path, e = env(), headers = ID) => worker.fetch(new Request("https://w.example" + path, { headers }), e);

test("health ohne Geräte-ID", async () => {
  const r = await get("/health", env(), {});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test("Rundkurs wird mit geheimem Schlüssel und bereinigtem Inhalt weitergeleitet", async () => {
  calls.length = 0;
  const r = await post("/route/foot-hiking", goodBody);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-ratelimit-remaining"), "1999");
  const c = calls[0];
  assert.equal(c.url, "https://api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson");
  assert.equal(c.init.headers.Authorization, "GEHEIM");
  const sent = JSON.parse(c.init.body);
  assert.deepEqual(sent.options.round_trip, { length: 8000, points: 5, seed: 42 });
  assert.deepEqual(sent.options.profile_params.weightings, { green: 1, quiet: 0.3 });
  assert.deepEqual(sent.extra_info, ["waytype", "surface", "green"]);
  assert.equal(sent.api_key, undefined);
  assert.equal(sent.options.avoid_features, undefined);
  assert.equal(sent.elevation, true);
});

test("ungültige Anfragen werden abgelehnt", async () => {
  calls.length = 0;
  assert.equal((await post("/route/driving-car", goodBody)).status, 400);
  assert.equal((await post("/route/foot-hiking", { ...goodBody, options: { round_trip: { length: 900000 } } })).status, 400);
  assert.equal((await post("/route/foot-hiking", { ...goodBody, coordinates: [[1, 2], [3, 4]] })).status, 400);
  assert.equal((await post("/route/foot-hiking", "kein json")).status, 400);
  assert.equal((await post("/route/foot-hiking", "x".repeat(30000))).status, 413);
  assert.equal((await post("/route/foot-hiking", goodBody, env(), {})).status, 400);       // ohne Geräte-ID
  assert.equal((await get("/route/foot-hiking")).status, 405);
  assert.equal((await get("/v2/directions/foot-hiking")).status, 404);
  assert.equal(calls.length, 0, "nichts darf an openrouteservice gehen");
});

test("Fehlerformat wie openrouteservice", async () => {
  const r = await post("/route/driving-car", goodBody);
  const j = await r.json();
  assert.ok(j.error && typeof j.error.message === "string");
});

test("Limit je Gerät: 31. Anfrage pro Minute → 429", async () => {
  const e = env();
  for (let i = 0; i < 30; i++) assert.equal((await post("/route/foot-hiking", goodBody, e)).status, 200);
  const r = await post("/route/foot-hiking", goodBody, e);
  assert.equal(r.status, 429);
  assert.match((await r.json()).error.message, /Rate limit/);
  // anderes Gerät ist nicht betroffen
  assert.equal((await post("/route/foot-hiking", goodBody, e, { "X-Install-Id": "anderes-geraet-1234" })).status, 200);
});

test("Gesamtlimit greift über alle Geräte", async () => {
  const e = env();
  let ok = 0, blocked = 0;
  for (let i = 0; i < 45; i++) {
    const r = await post("/route/foot-walking", goodBody, e, { "X-Install-Id": "geraet-" + String(i).padStart(4, "0") });
    r.status === 200 ? ok++ : blocked++;
  }
  assert.equal(ok, 38); assert.equal(blocked, 7);
});

test("Ortssuche: Schlüssel vom Server, Parameter geprüft", async () => {
  calls.length = 0;
  const r = await get("/geocode/search?text=Hauptstra%C3%9Fe%205%2C%20Lauf&size=99&lang=de&focus.point.lat=49.5&focus.point.lon=11.2&api_key=fremd");
  assert.equal(r.status, 200);
  const u = new URL(calls[0].url);
  assert.equal(u.origin + u.pathname, "https://api.heigit.org/pelias/v1/search");
  assert.equal(u.searchParams.get("api_key"), "GEHEIM");
  assert.equal(u.searchParams.get("text"), "Hauptstraße 5, Lauf");
  assert.equal(u.searchParams.get("size"), "7");          // 99 ist zu groß → Standard
  assert.equal(u.searchParams.get("focus.point.lat"), "49.5");
  assert.equal((await get("/geocode/search?text=")).status, 400);
  assert.equal((await get("/geocode/reverse?text=x")).status, 404);
});

test("ohne Schlüssel im Server: klare Meldung", async () => {
  const r = await post("/route/foot-hiking", goodBody, { RL_DEVICE: limiter(30) });
  assert.equal(r.status, 500);
});

test("ohne Rate-Limit-Bindungen funktioniert der Server trotzdem", async () => {
  const r = await post("/route/foot-hiking", goodBody, { ORS_API_KEY: "GEHEIM" });
  assert.equal(r.status, 200);
});
