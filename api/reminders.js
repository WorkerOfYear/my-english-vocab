// Telegram reminders at a time and on days the learner picks, one setting per kind:
//   words   — words due for review today (no message if nothing is due)
//   grammar — the rule of the week (no message if it has already been practised this week)
//   cuff    — "Speak off the cuff" (no message if a recording was already sent today)
//
//   GET  /api/reminders?kind=words        — (sync key or Mini App) settings + when the scheduler last called
//   PUT  /api/reminders?kind=words        — (sync key or Mini App) body {enabled, time: "19:30", days: [1..7], tz}
//   POST /api/reminders?kind=words&test=1 — (sync key or Mini App) send that reminder right now
//   GET|PUT /api/reminders?quotes=1       — (sync key or Mini App) the Statham quote at the end: {enabled, mat}
//   GET|POST /api/reminders?tick=1        — external scheduler (cron-job.org, every 5 min), with CRON_SECRET:
//        sends every reminder whose time has come, once a day each.
// /api/cuff-remind is the same handler (kind defaults to cuff) — older scheduler links keep working.
// Vercel Cron on the free plan runs at most once a day, so it can't hit an arbitrary minute — hence the external tick.
const {
  redis, KEY_CUFF_REMIND, cuffDoneKey, loadState, dueWords, sendReminder,
  quoteLine, quoteSettings, saveQuoteSettings, checkAuth, safeEqual, telegram, ownerId, appButton, readJson, send, handle, httpError, query, today,
} = require("./_lib");

const KEY_TICK = "vocab:cuff_tick";
const LATE_MIN = 180; // if the scheduler was down, don't send a reminder more than 3 hours late
const TZ = process.env.TIMEZONE || "Asia/Novosibirsk";

const KINDS = {
  words: { key: "vocab:remind:words", defaults: { enabled: true, time: "19:00", days: [1, 2, 3, 4, 5, 6, 7] } },
  grammar: { key: "vocab:remind:grammar", defaults: { enabled: false, time: "19:00", days: [1] } },
  cuff: { key: KEY_CUFF_REMIND, defaults: { enabled: false, time: "19:00", days: [1, 2, 3, 4, 5, 6, 7] } },
};
const sentKey = (kind, date) => `vocab:remind_sent:${kind}:${date}`;

async function load(kind) {
  const raw = await redis("GET", KINDS[kind].key);
  return Object.assign({ tz: TZ }, KINDS[kind].defaults, raw ? JSON.parse(raw) : {}, { saved: !!raw });
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

async function chatId() {
  const chat = await ownerId();
  if (!chat) throw httpError(409, "Бот ещё не подключён: нажми «🤖 Подключить бота» в трекере");
  return chat;
}

// Each sender returns false when there is nothing worth a message.
const SENDERS = {
  async words(req, { test, date }) {
    const doc = await loadState();
    const due = dueWords(doc && doc.data && doc.data.srs, date);
    return (await sendReminder(req, due, { test })).sent;
  },
  async grammar(req, { test }) {
    const doc = await loadState();
    const g = (doc && doc.data && doc.data.grammar) || {};
    const done = g.curId && g.rules && g.rules[g.curId] && g.weekOf && (g.rules[g.curId].last || "") >= g.weekOf;
    if (done && !test) return false;
    const rule = g.curTitle ? `\n\nПравило недели: ${g.curUnit ? g.curUnit + " · " : ""}${g.curTitle}` : "";
    await telegram("sendMessage", {
      chat_id: await chatId(),
      text: `📘 Время для грамматики!${rule}\n\nПрочитай правило и сделай упражнения.` + (await quoteLine()),
      reply_markup: { inline_keyboard: [[appButton(req, "📘 Открыть правило", "grammar")]] },
    });
    return true;
  },
  async cuff(req, { test, date }) {
    if (!test && await redis("GET", cuffDoneKey(date))) return false;
    await telegram("sendMessage", {
      chat_id: await chatId(),
      text: "🎙️ Время для Speak off the cuff!\n\nКрути рулетку и поговори пару минут на случайную тему." + (await quoteLine()),
      reply_markup: { inline_keyboard: [[appButton(req, "🎡 Крутить рулетку", "cuff")]] },
    });
    return true;
  },
};

function checkTickSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw httpError(500, "На сервере не задан CRON_SECRET");
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || query(req).get("secret") || "";
  if (!got || !safeEqual(got, secret)) throw httpError(401, "Неверный CRON_SECRET");
}

async function tickOne(req, kind) {
  const s = await load(kind);
  // Words: until the learner picks a time, the daily Vercel Cron (api/remind.js) keeps sending them.
  if (!s.enabled || (kind === "words" && !s.saved)) return "off";
  const now = localNow(s.tz);
  const [h, m] = s.time.split(":").map(Number);
  const late = now.minutes - (h * 60 + m);
  if (!s.days.includes(now.weekday) || late < 0 || late > LATE_MIN) return "not now";
  // SET NX: two overlapping ticks can't both send.
  if (!(await redis("SET", sentKey(kind, now.date), "1", "NX", "EX", 3 * 86400))) return "already sent";
  return (await SENDERS[kind](req, { date: now.date })) ? "sent" : "nothing to send";
}

async function tick(req, res) {
  checkTickSecret(req);
  await redis("SET", KEY_TICK, String(Date.now()));
  const result = {};
  for (const kind of Object.keys(KINDS)) {
    try { result[kind] = await tickOne(req, kind); } catch (e) { result[kind] = "error: " + e.message; }
  }
  send(res, 200, result);
}

module.exports = handle(async (req, res) => {
  const q = query(req);
  if (q.get("tick") === "1") return tick(req, res);
  await checkAuth(req);
  // Statham quotes in reminders: GET → {enabled, mat}, PUT {enabled, mat}.
  if (q.get("quotes") === "1") {
    if (req.method === "PUT" || req.method === "POST") await saveQuoteSettings(await readJson(req));
    return send(res, 200, { quotes: await quoteSettings() });
  }
  const kind = q.get("kind") || "cuff";
  if (!KINDS[kind]) throw httpError(400, "Неизвестное напоминание");
  if (q.get("test") === "1" && req.method === "POST") {
    const sent = await SENDERS[kind](req, { test: true, date: localNow((await load(kind)).tz).date });
    return send(res, 200, { sent });
  }
  if (req.method === "GET") {
    const lastTick = Number(await redis("GET", KEY_TICK)) || 0;
    return send(res, 200, { settings: await load(kind), lastTick, cronSecret: !!process.env.CRON_SECRET });
  }
  if (req.method === "PUT" || req.method === "POST") {
    const body = await readJson(req);
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time) ? body.time : null;
    const days = Array.isArray(body.days) ? [...new Set(body.days.map(Number))].filter((d) => d >= 1 && d <= 7).sort() : null;
    if (!time || !days || !days.length) throw httpError(400, "Неверное время или дни");
    const settings = { enabled: !!body.enabled, time, days, tz: validTz(body.tz) ? body.tz : TZ };
    await redis("SET", KINDS[kind].key, JSON.stringify(settings));
    return send(res, 200, { settings: { ...settings, saved: true } });
  }
  throw httpError(405, "Method not allowed");
});
