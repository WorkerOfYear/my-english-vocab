// Daily Vercel Cron (see vercel.json) — sends a Telegram message if there are words to review today.
// Once the learner picks their own time for this reminder, /api/reminders sends it instead and the cron steps aside.
// POST /api/remind?test=1 (sync key or Mini App) sends a test message right away (used by the "Проверить" button).
const { redis, loadState, checkAuth, dueWords, sendReminder, send, handle, httpError } = require("./_lib");

function fromCron(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.authorization === `Bearer ${secret}`;
  return /vercel-cron/i.test(req.headers["user-agent"] || "");
}

module.exports = handle(async (req, res) => {
  const test = /[?&]test=1\b/.test(req.url || "");
  if (test) await checkAuth(req);
  else if (!fromCron(req)) throw httpError(401, "Только для Vercel Cron");

  if (!test && (await redis("GET", "vocab:remind:words"))) return send(res, 200, { sent: false, reason: "custom schedule" });
  const doc = await loadState();
  const due = dueWords(doc && doc.data && doc.data.srs);
  const result = await sendReminder(req, due, { test });
  send(res, 200, result);
});
