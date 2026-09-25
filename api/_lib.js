// Shared helpers for the serverless functions (files starting with "_" are not exposed as routes).
const crypto = require("crypto");

const KEY_STATE = "vocab:state";
const KEY_OWNER = "vocab:tg_owner"; // chat id of the learner (private chat id == Telegram user id)
const KEY_LINK = "vocab:tg_link"; // one-time code for t.me/<bot>?start=<code>

// ---------- storage: Upstash Redis REST API (Vercel Marketplace → Upstash for Redis)
// Vercel may add a custom prefix to the variable names (e.g. STORAGE_KV_REST_API_URL), so match by suffix.
const envBySuffix = (re) => {
  const name = Object.keys(process.env).find((k) => re.test(k) && !/READ_ONLY/.test(k) && process.env[k]);
  return name ? process.env[name] : undefined;
};

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || envBySuffix(/(KV_REST_API|REDIS_REST)_URL$/);
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || envBySuffix(/(KV_REST_API|REDIS_REST)_TOKEN$/);
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

async function ownerId() {
  return process.env.TELEGRAM_CHAT_ID || (await redis("GET", KEY_OWNER)) || null;
}
const setOwner = (id) => redis("SET", KEY_OWNER, String(id));

// ---------- auth
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function checkSyncKey(req) {
  const expected = process.env.SYNC_KEY;
  if (!expected) throw httpError(500, "На сервере не задан SYNC_KEY");
  if (!req.headers["x-sync-key"] || !safeEqual(req.headers["x-sync-key"], expected)) throw httpError(401, "Неверный ключ синхронизации");
}

// Telegram Mini App launch data, signed with the bot token:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData, maxAgeSec = 7 * 24 * 3600) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (!safeEqual(hash, expected)) return null;
  if (Date.now() / 1000 - Number(params.get("auth_date") || 0) > maxAgeSec) return null;
  try { return JSON.parse(params.get("user") || "null"); } catch (e) { return null; }
}

// Either the sync key (website) or valid Mini App data from the bot's owner (inside Telegram).
async function checkAuth(req) {
  const init = req.headers["x-telegram-init-data"];
  if (init && !req.headers["x-sync-key"]) {
    const user = verifyInitData(init);
    if (!user) throw httpError(401, "Не удалось проверить вход через Telegram — открой приложение заново");
    const owner = await ownerId();
    if (!owner || String(user.id) !== String(owner)) throw httpError(403, "Это личное приложение: бот привязан к другому аккаунту");
    return;
  }
  checkSyncKey(req);
}

// Secret Telegram sends back with every webhook call, so nobody else can post fake updates.
function webhookSecret() {
  const base = process.env.WEBHOOK_SECRET || process.env.SYNC_KEY || "";
  return crypto.createHash("sha256").update("webhook:" + base).digest("hex").slice(0, 48);
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

async function chatId() {
  const id = await ownerId();
  if (!id) throw httpError(409, "Бот ещё не подключён: нажми «🤖 Подключить бота» в трекере");
  return id;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `https://${req.headers.host}`;
}

// Button that opens the site inside Telegram as a Mini App, on a given page.
const appButton = (req, text, page) => ({ text, web_app: { url: `${siteUrl(req)}/${page ? `?page=${page}` : ""}` } });

const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
const words = (n) => `${n} ${plural(n, "слово", "слова", "слов")}`;

function reminderText(due, { test = false } = {}) {
  const n = due.length;
  if (!n) return test ? "✅ Бот подключён. Сейчас повторять нечего — напомню, когда подойдёт срок." : "";
  const list = due.slice(0, 8).join(", ") + (n > 8 ? ` и ещё ${n - 8}` : "");
  return `${test ? "✅ Бот подключён.\n\n" : ""}🗓️ Пора повторить ${words(n)}\n\n${list}`;
}

async function sendReminder(req, due, opts) {
  const text = reminderText(due, opts);
  if (!text) return { sent: false, due: 0 };
  await telegram("sendMessage", {
    chat_id: await chatId(),
    text,
    reply_markup: { inline_keyboard: [[due.length ? appButton(req, "▶️ Начать повторение", "review") : appButton(req, "📚 Открыть", "")]] },
  });
  return { sent: true, due: due.length };
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

const query = (req) => new URLSearchParams((req.url || "").split("?")[1] || "");

module.exports = {
  redis, KEY_LINK, loadState, saveState, ownerId, setOwner,
  checkSyncKey, checkAuth, verifyInitData, webhookSecret, safeEqual,
  today, dueWords, telegram, siteUrl, appButton, words, reminderText, sendReminder,
  readJson, send, handle, httpError, query,
};
