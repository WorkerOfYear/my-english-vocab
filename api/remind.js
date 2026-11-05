// Daily Vercel Cron (see vercel.json) — sends each account a Telegram message if it has words to review today.
// Once an account picks its own time for this reminder, /api/reminders sends it instead and the cron skips that account.
// POST /api/remind?test=1 (signed in) sends a test message right away.
const { redis, uk, loadState, listUsers, chatOf, checkAuth, dueWords, sendReminder, send, handle, httpError } = require("./_lib");

function fromCron(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.authorization === `Bearer ${secret}`;
  return /vercel-cron/i.test(req.headers["user-agent"] || "");
}

async function remindOne(req, uid, test) {
  const doc = await loadState(uid);
  return sendReminder(req, uid, dueWords(doc && doc.data && doc.data.srs), { test });
}

module.exports = handle(async (req, res) => {
  if (/[?&]test=1\b/.test(req.url || "")) return send(res, 200, await remindOne(req, await checkAuth(req), true));
  if (!fromCron(req)) throw httpError(401, "Только для Vercel Cron");

  const result = {};
  for (const uid of await listUsers()) {
    try {
      if (!(await chatOf(uid))) result[uid] = { sent: false, reason: "no telegram" };
      else if (await redis("GET", uk(uid, "remind:words"))) result[uid] = { sent: false, reason: "custom schedule" };
      else result[uid] = await remindOne(req, uid, false);
    } catch (e) {
      result[uid] = { error: e.message };
    }
  }
  send(res, 200, result);
});
