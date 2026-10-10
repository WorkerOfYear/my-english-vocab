// Reminder for "Speak off the cuff" at a time and on days the learner picks.
//   GET  /api/cuff-remind           — (sync key or Mini App) settings + when the scheduler last called
//   PUT  /api/cuff-remind           — (sync key or Mini App) body {enabled, time: "19:30", days: [1..7], tz}
//   POST /api/cuff-remind?test=1    — (sync key or Mini App) send the reminder right now
//   GET|POST /api/cuff-remind?tick=1 — external scheduler (cron-job.org, every 5–15 min), with CRON_SECRET:
//        sends the reminder once a day, when the chosen time has come.
// Vercel Cron on the free plan runs at most once a day, so it can't hit an arbitrary minute — hence the external tick.
const { redis, KEY_CUFF_REMIND, cuffDoneKey, checkAuth, safeEqual, telegram, ownerId, appButton, readJson, send, handle, httpError, query, today } = require("./_lib");

const KEY = KEY_CUFF_REMIND;
const KEY_TICK = "vocab:cuff_tick";
const sentKey = (date) => `vocab:cuff_sent:${date}`;
const LATE_MIN = 180; // if the scheduler was down, don't send a reminder more than 3 hours late

const DEFAULTS = { enabled: false, time: "19:00", days: [1, 2, 3, 4, 5, 6, 7], tz: process.env.TIMEZONE || "Asia/Novosibirsk" };

async function load() {
  const raw = await redis("GET", KEY);
  return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
}

function validTz(tz) {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch (e) { return false; }
}

// Local date, minutes since midnight and ISO weekday (1 = Monday) in the learner's time zone.
function localNow(tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    date: today(tz),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1,
  };
}

async function remind(req) {
  const chat = await ownerId();
  if (!chat) throw httpError(409, "Бот ещё не подключён: нажми «🤖 Подключить бота» в трекере");
  await telegram("sendMessage", {
    chat_id: chat,
    text: "🎙️ Время для Speak off the cuff!\n\nКрути рулетку и поговори пару минут на случайную тему.",
    reply_markup: { inline_keyboard: [[appButton(req, "🎡 Крутить рулетку", "cuff")]] },
  });
}

function checkTickSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw httpError(500, "На сервере не задан CRON_SECRET");
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || query(req).get("secret") || "";
  if (!got || !safeEqual(got, secret)) throw httpError(401, "Неверный CRON_SECRET");
}

async function tick(req, res) {
  checkTickSecret(req);
  await redis("SET", KEY_TICK, String(Date.now()));
  const s = await load();
  const now = localNow(s.tz);
  const [h, m] = s.time.split(":").map(Number);
  const late = now.minutes - (h * 60 + m);
  if (!s.enabled || !s.days.includes(now.weekday) || late < 0 || late > LATE_MIN) return send(res, 200, { sent: false });
  if (await redis("GET", cuffDoneKey(now.date))) return send(res, 200, { sent: false, reason: "already practised today" });
  // SET NX: two overlapping ticks can't both send.
  if (!(await redis("SET", sentKey(now.date), "1", "NX", "EX", 3 * 86400))) return send(res, 200, { sent: false });
  await remind(req);
  send(res, 200, { sent: true });
}

module.exports = handle(async (req, res) => {
  const q = query(req);
  if (q.get("tick") === "1") return tick(req, res);
  await checkAuth(req);
  if (q.get("test") === "1" && req.method === "POST") {
    await remind(req);
    return send(res, 200, { sent: true });
  }
  if (req.method === "GET") {
    const lastTick = Number(await redis("GET", KEY_TICK)) || 0;
    return send(res, 200, { settings: await load(), lastTick, cronSecret: !!process.env.CRON_SECRET });
  }
  if (req.method === "PUT" || req.method === "POST") {
    const body = await readJson(req);
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time) ? body.time : null;
    const days = Array.isArray(body.days) ? [...new Set(body.days.map(Number))].filter((d) => d >= 1 && d <= 7).sort() : null;
    if (!time || !days || !days.length) throw httpError(400, "Неверное время или дни");
    const settings = { enabled: !!body.enabled, time, days, tz: validTz(body.tz) ? body.tz : DEFAULTS.tz };
    await redis("SET", KEY, JSON.stringify(settings));
    return send(res, 200, { settings });
  }
  throw httpError(405, "Method not allowed");
});
