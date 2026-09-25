// Shared helpers for the serverless functions (files starting with "_" are not exposed as routes).
const KEY_STATE = "vocab:state";
const KEY_CHAT = "vocab:tg_chat";

// ---------- storage: Upstash Redis REST API (Vercel Marketplace → Upstash for Redis)
function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw httpError(500, "Хранилище не подключено: добавь Upstash for Redis в Vercel → Storage");
  return { url, token };
}

async function redis(...command) {
  const { url, token } = redisConfig();
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw httpError(502, "Ошибка хранилища: " + (data.error || r.status));
  return data.result;
}

async function loadState() {
  const raw = await redis("GET", KEY_STATE);
  return raw ? JSON.parse(raw) : null;
}
const saveState = (doc) => redis("SET", KEY_STATE, JSON.stringify(doc));

// ---------- auth
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function checkSyncKey(req) {
  const expected = process.env.SYNC_KEY;
  if (!expected) throw httpError(500, "На сервере не задан SYNC_KEY");
  if (req.headers["x-sync-key"] !== expected) throw httpError(401, "Неверный ключ синхронизации");
}

// ---------- dates in the learner's time zone (due dates are local calendar days)
function today(timeZone = process.env.TIMEZONE || "Asia/Novosibirsk") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Same rule as dueWords() in js/srs.js: active group, not learned (step < 6), due today or earlier.
function dueWords(srs, onDate = today()) {
  if (!srs || !Array.isArray(srs.groups)) return [];
  const out = [];
  for (const g of srs.groups) {
    if (g.completedAt) continue;
    for (const en of g.words) {
      const c = srs.cards && srs.cards[en];
      if (c && c.step < 6 && c.due && c.due <= onDate && !out.includes(en)) out.push(en);
    }
  }
  return out;
}

// ---------- Telegram
async function telegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw httpError(500, "На сервере не задан TELEGRAM_BOT_TOKEN");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) throw httpError(502, "Telegram: " + (data.description || r.status));
  return data.result;
}

// Chat to write to: env TELEGRAM_CHAT_ID, or remembered from the last /start sent to the bot.
async function chatId() {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  const saved = await redis("GET", KEY_CHAT);
  if (saved) return saved;
  const updates = await telegram("getUpdates", { allowed_updates: ["message"] });
  const last = updates.reverse().find((u) => u.message && u.message.chat);
  if (!last) throw httpError(409, "Бот тебя пока не знает: открой бота в Telegram, нажми Start и попробуй ещё раз");
  await redis("SET", KEY_CHAT, String(last.message.chat.id));
  return String(last.message.chat.id);
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `https://${req.headers.host}`;
}

const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

function reminderText(words, { test = false } = {}) {
  const n = words.length;
  if (!n) return test ? "✅ Бот подключён. Сейчас повторять нечего — напомню, когда подойдёт срок." : "";
  const list = words.slice(0, 8).join(", ") + (n > 8 ? ` и ещё ${n - 8}` : "");
  return `${test ? "✅ Бот подключён.\n\n" : ""}🗓️ Пора повторить ${n} ${plural(n, "слово", "слова", "слов")}\n\n${list}`;
}

async function sendReminder(req, words, opts) {
  const text = reminderText(words, opts);
  if (!text) return { sent: false, due: 0 };
  await telegram("sendMessage", {
    chat_id: await chatId(),
    text,
    reply_markup: words.length ? { inline_keyboard: [[{ text: "▶️ Начать повторение", url: `${siteUrl(req)}/#review` }]] } : undefined,
  });
  return { sent: true, due: words.length };
}

// ---------- tiny request/response helpers
async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};

module.exports = { loadState, saveState, checkSyncKey, today, dueWords, sendReminder, readJson, send, handle, httpError, reminderText };
