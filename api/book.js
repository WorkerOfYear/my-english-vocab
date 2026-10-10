// Course book material (Grammar Bank + Workbook exercises), private to the learner.
// It is copyrighted, so it never goes into git or the public static files: the learner uploads the file once,
// it is kept in their own Redis, and only they can read it (sync key or their Telegram Mini App).
//   GET /api/book  → { book: {meta, units: {"1A": {...}}} | null }
//   PUT /api/book  body: the same object → stored unit by unit (Upstash rejects requests over 1 MB)
const { redis, checkAuth, readJson, send, handle, httpError } = require("./_lib");

const KEY_INDEX = "vocab:book:index";
const unitKey = (u) => `vocab:book:unit:${u}`;

module.exports = handle(async (req, res) => {
  await checkAuth(req);
  if (req.method === "GET") {
    const raw = await redis("GET", KEY_INDEX);
    if (!raw) return send(res, 200, { book: null });
    const index = JSON.parse(raw);
    const values = index.units.length ? await redis("MGET", ...index.units.map(unitKey)) : [];
    const units = {};
    index.units.forEach((u, i) => { if (values[i]) units[u] = JSON.parse(values[i]); });
    return send(res, 200, { book: { meta: index.meta, units } });
  }
  if (req.method === "PUT" || req.method === "POST") {
    const book = await readJson(req);
    const names = book && book.units && typeof book.units === "object" ? Object.keys(book.units) : [];
    if (!names.length || !names.every((u) => /^\d{1,2}[AB]$/.test(u))) throw httpError(400, "Это не файл с материалами учебника");
    for (const u of names) await redis("SET", unitKey(u), JSON.stringify(book.units[u]));
    await redis("SET", KEY_INDEX, JSON.stringify({ meta: book.meta || {}, units: names }));
    return send(res, 200, { ok: true, units: names.length });
  }
  throw httpError(405, "Method not allowed");
});
