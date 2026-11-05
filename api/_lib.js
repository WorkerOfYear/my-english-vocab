// Shared helpers for the serverless functions (files starting with "_" are not exposed as routes).
const crypto = require("crypto");

// ---------- accounts
// Every account has its own progress, settings and Telegram chat. Keys are "vocab:u:<uid>:<name>", except for
// LEGACY_UID: that account owns everything saved before accounts existed, so its keys stay "vocab:<name>".
const LEGACY_UID = "artem";
const ADMIN_UIDS = [LEGACY_UID]; // can create accounts and reset passwords (⚙️ Настройки → Аккаунты)
const isAdmin = (uid) => ADMIN_UIDS.includes(uid);
const uk = (uid, name) => (uid === LEGACY_UID ? `vocab:${name}` : `vocab:u:${uid}:${name}`);
const KEY_USERS = "vocab:users"; // set of uids
const accountKey = (uid) => `vocab:account:${uid}`; // {login, salt, hash, created}
const sessionKey = (token) => `vocab:session:${token}`; // → uid
const linkKey = (code) => `vocab:tg_link:${code}`; // one-time code for t.me/<bot>?start=<code> → uid
const chatKey = (chat) => `vocab:tg_chat:${chat}`; // Telegram chat → uid
const SESSION_TTL = 365 * 86400;

// Accounts created on first use (scrypt hashes, the passwords themselves are not stored anywhere).
const SEED_ACCOUNTS = [
  { login: "Artem", salt: "697a5853bde150a6adc1b64670191cb7", hash: "f301ce172993f25d81d704a2051d6bb9540a15c9f274485535c6f8ba1417f151" },
  { login: "Angel", salt: "89935270e5758acc9db02736fda4a3e2", hash: "18a42c050fa3543ae2f82a31fc453104f34383c0340c17a9f54c35f396d298e5" },
];

const cuffDoneKey = (uid, date) => uk(uid, `cuff_done:${date}`); // a recording was sent that day → no reminder

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

async function loadState(uid) {
  const raw = await redis("GET", uk(uid, "state"));
  return raw ? JSON.parse(raw) : null;
}
const saveState = (uid, doc) => redis("SET", uk(uid, "state"), JSON.stringify(doc));

// ---------- accounts and sessions
const normLogin = (login) => String(login || "").trim().toLowerCase();
const hashPassword = (password, salt) => crypto.scryptSync(String(password), salt, 32).toString("hex");

async function ensureSeedAccounts() {
  for (const a of SEED_ACCOUNTS) {
    const uid = normLogin(a.login);
    await redis("SET", accountKey(uid), JSON.stringify({ ...a, created: Date.now() }), "NX");
    await redis("SADD", KEY_USERS, uid);
  }
}

async function listUsers() {
  await ensureSeedAccounts();
  return (await redis("SMEMBERS", KEY_USERS)) || [];
}

async function getAccount(uid) {
  const raw = await redis("GET", accountKey(uid));
  return raw ? JSON.parse(raw) : null;
}

async function createAccount(login, password) {
  const uid = normLogin(login);
  if (!/^[a-z0-9_.-]{2,32}$/.test(uid)) throw httpError(400, "Логин: 2–32 латинские буквы, цифры, точка, дефис или _");
  if (String(password || "").length < 4) throw httpError(400, "Пароль слишком короткий");
  const salt = crypto.randomBytes(16).toString("hex");
  const ok = await redis("SET", accountKey(uid), JSON.stringify({ login: String(login).trim(), salt, hash: hashPassword(password, salt), created: Date.now() }), "NX");
  if (!ok) throw httpError(409, "Такой логин уже есть");
  await redis("SADD", KEY_USERS, uid);
  return uid;
}

// Checks the password (10 wrong attempts → 15 minutes pause), returns the account.
async function checkPassword(login, password) {
  await ensureSeedAccounts();
  const uid = normLogin(login);
  const failKey = `vocab:login_fail:${uid}`;
  if (Number(await redis("GET", failKey)) >= 10) throw httpError(429, "Слишком много попыток — подожди 15 минут");
  const acc = uid && (await getAccount(uid));
  if (!acc || !safeEqual(hashPassword(password, acc.salt), acc.hash)) {
    if (acc) { await redis("INCR", failKey); await redis("EXPIRE", failKey, 900); }
    throw httpError(401, "Неверный логин или пароль");
  }
  await redis("DEL", failKey);
  return { uid, ...acc };
}

async function setPassword(uid, password) {
  if (String(password || "").length < 4) throw httpError(400, "Пароль слишком короткий");
  const acc = await getAccount(uid);
  if (!acc) throw httpError(404, "Аккаунт не найден");
  acc.salt = crypto.randomBytes(16).toString("hex");
  acc.hash = hashPassword(password, acc.salt);
  await redis("SET", accountKey(uid), JSON.stringify(acc));
}

async function createSession(uid) {
  const token = crypto.randomBytes(32).toString("hex");
  await redis("SET", sessionKey(token), uid, "EX", SESSION_TTL);
  const acc = await getAccount(uid);
  return { token, uid, login: (acc && acc.login) || uid, legacy: uid === LEGACY_UID, admin: isAdmin(uid) };
}
const dropSession = (token) => redis("DEL", sessionKey(token));

// ---------- Telegram chat of each account (private chat id == Telegram user id)
async function chatOf(uid) {
  if (uid === LEGACY_UID && process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  return (await redis("GET", uk(uid, "tg_owner"))) || null;
}

async function uidByChat(chat) {
  const uid = await redis("GET", chatKey(chat));
  if (uid) return uid;
  // The chat bound before accounts existed belongs to the legacy account.
  const legacy = await chatOf(LEGACY_UID);
  return legacy && String(legacy) === String(chat) ? LEGACY_UID : null;
}

// One chat ↔ one account: binding moves the chat away from whoever had it.
async function bindChat(uid, chat) {
  chat = String(chat);
  const prevUid = await uidByChat(chat);
  if (prevUid && prevUid !== uid) await redis("DEL", uk(prevUid, "tg_owner"));
  const prevChat = await redis("GET", uk(uid, "tg_owner"));
  if (prevChat && prevChat !== chat) await redis("DEL", chatKey(prevChat));
  await redis("SET", uk(uid, "tg_owner"), chat);
  await redis("SET", chatKey(chat), uid);
}

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

// Who is calling → uid. A session token (login + password), or Mini App launch data of a Telegram user bound to an account.
async function checkAuth(req) {
  const token = req.headers["x-session"];
  if (token) {
    const uid = /^[0-9a-f]{64}$/.test(token) ? await redis("GET", sessionKey(token)) : null;
    if (!uid) throw httpError(401, "Сессия истекла — войди заново");
    return uid;
  }
  const init = req.headers["x-telegram-init-data"];
  if (init) {
    const user = verifyInitData(init);
    if (!user) throw httpError(401, "Не удалось проверить вход через Telegram — открой приложение заново");
    const uid = await uidByChat(user.id);
    if (!uid) throw httpError(401, "Этот Telegram не привязан к аккаунту — войди по логину и паролю");
    return uid;
  }
  throw httpError(401, "Войди в аккаунт");
}

async function checkAdmin(req) {
  const uid = await checkAuth(req);
  if (!isAdmin(uid)) throw httpError(403, "Это может только администратор");
  return uid;
}

// Secret Telegram sends back with every webhook call, so nobody else can post fake updates.
// Kept in Redis, so it doesn't depend on env variables. The first time it is the value the webhook was registered with
// before (derived from WEBHOOK_SECRET / the old SYNC_KEY), so the bot keeps working; otherwise a random one.
async function webhookSecret() {
  const saved = await redis("GET", "vocab:webhook_secret");
  if (saved) return saved;
  const base = process.env.WEBHOOK_SECRET || process.env.SYNC_KEY;
  const secret = base
    ? crypto.createHash("sha256").update("webhook:" + base).digest("hex").slice(0, 48)
    : crypto.randomBytes(24).toString("hex");
  await redis("SET", "vocab:webhook_secret", secret, "NX");
  return redis("GET", "vocab:webhook_secret");
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

async function chatId(uid) {
  const id = await chatOf(uid);
  if (!id) throw httpError(409, "Бот ещё не подключён: нажми «🤖 Подключить бота» в ⚙️ настройках");
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
  // Just the count — the words themselves are in the app (the quote follows, see sendReminder).
  return `${test ? "✅ Бот подключён.\n\n" : ""}🗓️ Пора повторить ${words(n)}`;
}

// ---------- a meme "Jason Statham quote" at the end of every reminder (api/_quotes.json: [text, has swearing])
// Per account: "quotes" — settings {enabled, mat}; "quotes_used" — quotes already sent in this lap (no repeats until all are used).
async function quoteSettings(uid) {
  const raw = await redis("GET", uk(uid, "quotes"));
  return Object.assign({ enabled: true, mat: true }, raw ? JSON.parse(raw) : {});
}
const saveQuoteSettings = (uid, s) => redis("SET", uk(uid, "quotes"), JSON.stringify({ enabled: !!s.enabled, mat: !!s.mat }));

// "\n\n💬 «…»" or "" — never fails the reminder itself.
async function quoteLine(uid) {
  try {
    const s = await quoteSettings(uid);
    if (!s.enabled) return "";
    const all = require("./_quotes.json").quotes;
    const pool = all.map((q, i) => i).filter((i) => s.mat || !all[i][1]);
    let used = JSON.parse((await redis("GET", uk(uid, "quotes_used"))) || "[]");
    let fresh = pool.filter((i) => !used.includes(i));
    if (!fresh.length) { used = []; fresh = pool; }
    const i = fresh[Math.floor(Math.random() * fresh.length)];
    await redis("SET", uk(uid, "quotes_used"), JSON.stringify([...used, i]));
    return `\n\n💬 «${all[i][0]}»\n— Джейсон Стэтхэм`;
  } catch (e) {
    return "";
  }
}

async function sendReminder(req, uid, due, opts) {
  const text = reminderText(due, opts);
  if (!text) return { sent: false, due: 0 };
  await telegram("sendMessage", {
    chat_id: await chatId(uid),
    text: text + (await quoteLine(uid)),
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
  redis, uk, LEGACY_UID, cuffDoneKey, loadState, saveState,
  listUsers, getAccount, createAccount, checkPassword, setPassword, createSession, dropSession,
  linkKey, chatOf, uidByChat, bindChat, chatId,
  isAdmin, checkAuth, checkAdmin, verifyInitData, webhookSecret, safeEqual,
  today, dueWords, telegram, quoteLine, quoteSettings, saveQuoteSettings, siteUrl, appButton, words, reminderText, sendReminder,
  readJson, send, handle, httpError, query,
};
