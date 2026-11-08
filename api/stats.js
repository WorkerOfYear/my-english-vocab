// 📊 Statistics of every account for the stats page (js/stats.js). Only numbers and logins leave the server —
// no words, groups or history.
// GET /api/stats → { users: [{login, me, learned, consolidated, learning, weeks:[8], accuracy, streak, since}] }
const { listUsers, getAccount, loadState, checkAuth, today, send, handle, httpError } = require("./_lib");

const LEARNED = 6;      // step after the 30-day review (js/srs.js)
const CONSOLIDATED = 4; // passed the 7-day review
const WEEKS = 8;

const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

function statsOf(srs, now) {
  const groups = (srs && Array.isArray(srs.groups)) ? srs.groups : [];
  const cards = (srs && srs.cards) || {};
  const inGroups = new Set(groups.flatMap((g) => g.words || []));
  const active = new Set(groups.filter((g) => !g.completedAt).flatMap((g) => g.words || []));
  let learned = 0, consolidated = 0, learning = 0, right = 0, answers = 0;
  const weeks = new Array(WEEKS).fill(0);
  const days = new Set();
  for (const [en, c] of Object.entries(cards)) {
    if (!inGroups.has(en) || !c) continue;
    const step = c.step || 0;
    if (step >= LEARNED) learned++;
    else if (step >= CONSOLIDATED) consolidated++;
    else if (active.has(en)) learning++;
    for (const [date, ok] of c.history || []) {
      answers++;
      if (ok) right++;
      days.add(date);
      const w = Math.floor(daysBetween(date, now) / 7); // 0 = the last 7 days
      if (w >= 0 && w < WEEKS) weeks[WEEKS - 1 - w]++;
    }
  }
  // Days in a row with reviews; not having reviewed yet today doesn't break it.
  let streak = 0;
  let d = days.has(now) ? now : addDays(now, -1);
  while (days.has(d)) { streak++; d = addDays(d, -1); }
  const since = groups.reduce((m, g) => (g.createdAt && (!m || g.createdAt < m) ? g.createdAt : m), "") || null;
  return { learned, consolidated, learning, weeks, accuracy: answers ? Math.round((right / answers) * 100) : null, streak, since };
}

module.exports = handle(async (req, res) => {
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  const me = await checkAuth(req);
  const now = today();
  const users = await Promise.all((await listUsers()).map(async (uid) => {
    const [acc, doc] = await Promise.all([getAccount(uid), loadState(uid)]);
    if (!acc) return null;
    return { login: acc.login || uid, me: uid === me, ...statsOf(doc && doc.data && doc.data.srs, now) };
  }));
  return send(res, 200, { users: users.filter(Boolean) });
});
