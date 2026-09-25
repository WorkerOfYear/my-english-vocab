// Telegram bot:
//   POST /api/telegram            — webhook: Telegram sends updates here (checked by secret header)
//   POST /api/telegram?setup=1    — (sync key) register webhook + menu button, return a one-time link to bind the bot
//   GET  /api/telegram?status=1   — (sync key or Mini App) bot name and whether it's bound to the learner
const crypto = require("crypto");
const {
  redis, KEY_LINK, loadState, ownerId, setOwner, checkAuth, checkSyncKey, webhookSecret, safeEqual,
  dueWords, telegram, siteUrl, appButton, words, readJson, send, handle, httpError, query,
} = require("./_lib");

async function setup(req, res) {
  checkSyncKey(req);
  const me = await telegram("getMe");
  await telegram("setWebhook", {
    url: `${siteUrl(req)}/api/telegram`,
    secret_token: webhookSecret(),
    allowed_updates: ["message"],
  });
  await telegram("setChatMenuButton", { menu_button: { type: "web_app", text: "Учить", web_app: { url: `${siteUrl(req)}/` } } });
  await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "Открыть приложение" },
      { command: "today", description: "Что повторить сегодня" },
    ],
  });
  const code = crypto.randomBytes(12).toString("hex");
  await redis("SET", KEY_LINK, code, "EX", 3600);
  send(res, 200, { bot: me.username, link: `https://t.me/${me.username}?start=${code}`, linked: !!(await ownerId()) });
}

async function status(req, res) {
  await checkAuth(req);
  const me = await telegram("getMe");
  send(res, 200, { bot: me.username, linked: !!(await ownerId()) });
}

async function todayMessage(req) {
  const doc = await loadState();
  const due = dueWords(doc && doc.data && doc.data.srs);
  return due.length
    ? { text: `🗓️ Сегодня к повторению ${words(due.length)}.`, button: appButton(req, "▶️ Начать повторение", "review") }
    : { text: "✨ На сегодня всё повторено.", button: appButton(req, "📚 Открыть приложение", "") };
}

async function webhook(req, res) {
  const got = req.headers["x-telegram-bot-api-secret-token"];
  if (!got || !safeEqual(got, webhookSecret())) throw httpError(401, "bad secret");
  const update = await readJson(req);
  const msg = update.message;
  if (!msg || !msg.chat || msg.chat.type !== "private") return send(res, 200, { ok: true });

  const chat = String(msg.chat.id);
  const text = (msg.text || "").trim();
  const reply = (t, button) => telegram("sendMessage", {
    chat_id: chat, text: t, reply_markup: button ? { inline_keyboard: [[button]] } : undefined,
  });

  const start = text.match(/^\/start(?:\s+(\S+))?/);
  const code = start && start[1];
  if (code) {
    const expected = await redis("GET", KEY_LINK);
    if (expected && safeEqual(code, expected)) {
      await setOwner(chat);
      await redis("DEL", KEY_LINK);
      await reply("✅ Готово! Теперь это твой бот: каждый вечер пришлю слова, которые пора повторить.\n\nПриложение открывается кнопкой «Учить» внизу.", appButton(req, "📚 Открыть приложение", ""));
      return send(res, 200, { ok: true });
    }
  }

  const owner = await ownerId();
  if (owner && chat === String(owner)) {
    const t = await todayMessage(req);
    await reply(t.text, t.button);
  } else {
    await reply("Это личный бот для изучения английских слов 🙂");
  }
  send(res, 200, { ok: true });
}

module.exports = handle(async (req, res) => {
  const q = query(req);
  if (q.get("setup") === "1" && req.method === "POST") return setup(req, res);
  if (q.get("status") === "1") return status(req, res);
  if (req.method === "POST") return webhook(req, res);
  throw httpError(405, "Method not allowed");
});
