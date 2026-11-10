// Bildet ctx.storage.sql eines Durable Objects mit node:sqlite nach (exec → Cursor mit toArray/one)
import { DatabaseSync } from "node:sqlite";
export function fakeCtx() {
  const db = new DatabaseSync(":memory:");
  return { storage: { sql: { exec(q, ...params) {
    const st = db.prepare(q);
    const rows = /^\s*(SELECT|WITH)/i.test(q) ? st.all(...params) : (st.run(...params), []);
    return { toArray: () => rows, one: () => { if (rows.length !== 1) throw new Error("expected one row"); return rows[0]; } };
  } } } };
}
