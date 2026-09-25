// GET  /api/state  → { doc: {updatedAt, data} | null }
// PUT  /api/state  body {updatedAt, base, data} → stores it if the stored version is still `base` (else 409)
const { loadState, saveState, checkSyncKey, readJson, send, handle, httpError } = require("./_lib");

module.exports = handle(async (req, res) => {
  checkSyncKey(req);
  if (req.method === "GET") return send(res, 200, { doc: await loadState() });
  if (req.method === "PUT" || req.method === "POST") {
    const doc = await readJson(req);
    if (!doc || typeof doc.updatedAt !== "number" || !doc.data || !doc.data.srs) throw httpError(400, "Неверный формат");
    // Optimistic lock: the client says which version it merged with; if another device wrote since, it must re-merge.
    if (typeof doc.base === "number") {
      const current = await loadState();
      if (current && current.updatedAt !== doc.base) throw httpError(409, "Данные изменились на другом устройстве");
    }
    await saveState({ updatedAt: doc.updatedAt, data: doc.data });
    return send(res, 200, { ok: true, updatedAt: doc.updatedAt });
  }
  throw httpError(405, "Method not allowed");
});
