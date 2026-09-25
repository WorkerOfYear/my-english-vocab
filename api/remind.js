// Daily Vercel Cron (see vercel.json) — sends a Telegram message if there are words to review today.
// POST /api/remind?test=1 with x-sync-key sends a test message right away (used by the "Проверить" button).
const { loadState, checkSyncKey, dueWords, sendReminder, send, handle, httpError } = require("./_lib");

function fromCron(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.authorization === `Bearer ${secret}`;
  return /vercel-cron/i.test(req.headers["user-agent"] || "");
}

module.exports = handle(async (req, res) => {
  const test = /[?&]test=1\b/.test(req.url || "");
  if (test) checkSyncKey(req);
  else if (!fromCron(req)) throw httpError(401, "Только для Vercel Cron");

  const doc = await loadState();
  const due = dueWords(doc && doc.data && doc.data.srs);
  const result = await sendReminder(req, due, { test });
  send(res, 200, result);
});
