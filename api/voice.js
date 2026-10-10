// POST /api/voice?level=C1&cat=...&secs=134&topic=...&q=...   body: the recording (audio/ogg, audio/mp4 or audio/webm)
// (sync key or Mini App) — sends the "Speak off the cuff" recording to the learner's Telegram chat.
const { redis, KEY_CUFF_REMIND, cuffDoneKey, today, checkAuth, ownerId, send, handle, httpError, query } = require("./_lib");

const MAX_BYTES = 4 * 1024 * 1024; // Vercel functions accept request bodies up to 4.5 MB

async function readRaw(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES) throw httpError(413, "Запись слишком длинная для отправки");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

const clip = (s, n) => String(s || "").slice(0, n);
const mmss = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

module.exports = handle(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  await checkAuth(req);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw httpError(500, "На сервере не задан TELEGRAM_BOT_TOKEN");
  const chat = await ownerId();
  if (!chat) throw httpError(409, "Бот ещё не подключён: нажми «🤖 Подключить бота» в трекере");

  const audio = await readRaw(req);
  if (!audio.length) throw httpError(400, "Пустая запись");
  if (audio.length > MAX_BYTES) throw httpError(413, "Запись слишком длинная для отправки");

  const q = query(req);
  const secs = Math.max(0, Math.round(Number(q.get("secs")) || 0));
  const caption = [
    ["🎙️ Speak off the cuff", clip(q.get("level"), 4), clip(q.get("cat"), 40), mmss(secs)].filter(Boolean).map(esc).join(" · "),
    "",
    `<b>${esc(clip(q.get("topic"), 100))}</b>`,
    esc(clip(q.get("q"), 400)),
  ].join("\n");

  // Ogg/Opus and M4A show up as a voice message; anything else (WebM) is sent as a file.
  const type = String(req.headers["content-type"] || "").split(";")[0].trim();
  const ext = { "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/aac": "m4a", "audio/mpeg": "mp3" }[type];
  const post = async (asVoice) => {
    const form = new FormData();
    form.append("chat_id", String(chat));
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    if (asVoice) form.append("duration", String(secs));
    const name = `speech.${ext || "webm"}`;
    form.append(asVoice ? "voice" : "document", new Blob([audio], { type: type || "audio/webm" }), name);
    const r = await fetch(`https://api.telegram.org/bot${token}/${asVoice ? "sendVoice" : "sendDocument"}`, { method: "POST", body: form });
    return r.json().catch(() => ({ description: String(r.status) }));
  };
  let data = await post(!!ext);
  // The learner may have forbidden voice messages in Telegram's privacy settings — send it as a file then.
  if (!data.ok && ext && /VOICE_MESSAGES_FORBIDDEN/.test(data.description || "")) data = await post(false);
  if (!data.ok) throw httpError(502, "Telegram: " + (data.description || "ошибка"));
  // Practised today → today's reminder (api/cuff-remind.js) isn't needed. Best effort: the voice is already sent.
  try {
    const raw = await redis("GET", KEY_CUFF_REMIND);
    const tz = (raw && JSON.parse(raw).tz) || undefined;
    await redis("SET", cuffDoneKey(today(tz)), "1", "EX", 2 * 86400);
  } catch (e) { /* storage not connected — fine */ }
  send(res, 200, { ok: true });
});

function esc(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
