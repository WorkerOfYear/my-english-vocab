// Rooms for co-op mini-games (js/games/tower.js). Both phones simulate the same game from a shared seed;
// the server only keeps the room (players, their words, the seed, the start time) and the list of events
// ("monster 12 killed by artem"), stamped with the server's clock so everyone agrees on what happened first.
//   GET  /api/game?list=1                                     → {rooms}          open rooms anyone can join
//   POST /api/game?create=1          body {game, words, solo} → {room}           new room, you're the host
//   POST /api/game?join=CODE         body {words}             → {room}
//   POST /api/game?start=CODE        (host)                   → {room}           start in 3 s with a new seed
//   POST /api/game?leave=CODE                                → {ok}
//   POST /api/game?event=CODE        body {type, id, part}    → {ok, ts}
//   GET  /api/game?room=CODE&since=N                          → {room, events: [...from N], now}
// A room lives 3 hours. words: [{en, ru}] — up to 120 words from the player's own dictionary.
const crypto = require("crypto");
const { redis, checkAuth, getAccount, readJson, send, handle, httpError, query } = require("./_lib");

const TTL = 3 * 3600;
const roomKey = (code) => `vocab:game:${code}`;
const eventsKey = (code, round) => `vocab:game:${code}:ev:${round}`;
const GAMES = ["tower"];
const MAX_PLAYERS = 2;
const KEY_ROOMS = "vocab:game:rooms"; // codes of rooms shown in the list (solo games aren't)

async function loadRoom(code) {
  if (!/^[A-Z]{4}$/.test(code || "")) throw httpError(400, "Неверный код комнаты");
  const raw = await redis("GET", roomKey(code));
  if (!raw) throw httpError(404, "Комната не найдена — проверь код");
  return JSON.parse(raw);
}
const saveRoom = (room) => redis("SET", roomKey(room.code), JSON.stringify(room), "EX", TTL);

function cleanWords(list) {
  const out = [];
  const seen = new Set();
  for (const w of Array.isArray(list) ? list : []) {
    const en = String((w && w.en) || "").trim().slice(0, 40);
    const ru = String((w && w.ru) || "").trim().slice(0, 60);
    if (!en || !ru || seen.has(en.toLowerCase())) continue;
    seen.add(en.toLowerCase());
    out.push({ en, ru });
    if (out.length >= 120) break;
  }
  if (out.length < 10) throw httpError(400, "В словаре слишком мало слов для игры");
  return out;
}

async function player(uid, words) {
  const acc = await getAccount(uid);
  return { uid, login: (acc && acc.login) || uid, words: cleanWords(words) };
}

const newSeed = () => crypto.randomBytes(4).readUInt32BE(0);
const newCode = () => Array.from(crypto.randomBytes(4), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 24]).join("");

module.exports = handle(async (req, res) => {
  const uid = await checkAuth(req);
  const q = query(req);
  const now = Date.now();

  if (req.method === "GET" && q.get("list") === "1") {
    const codes = (await redis("SMEMBERS", KEY_ROOMS)) || [];
    const raws = codes.length ? await redis("MGET", ...codes.map(roomKey)) : [];
    const rooms = [];
    for (let i = 0; i < codes.length; i++) {
      if (!raws[i]) { await redis("SREM", KEY_ROOMS, codes[i]); continue; } // expired
      const r = JSON.parse(raws[i]);
      const mine = r.players.some((p) => p.uid === uid);
      if (!mine && r.players.length >= MAX_PLAYERS) continue;
      rooms.push({ code: r.code, game: r.game, status: r.status, mine,
        host: (r.players.find((p) => p.uid === r.host) || {}).login || "", players: r.players.map((p) => p.login), created: r.created });
    }
    rooms.sort((a, b) => b.created - a.created);
    return send(res, 200, { rooms });
  }

  if (req.method === "GET" && q.get("room")) {
    const room = await loadRoom(q.get("room"));
    const since = Math.max(0, Number(q.get("since")) || 0);
    // Events of the current (or just finished) round — the other phone may still be catching up on its last second.
    const events = room.round ? ((await redis("LRANGE", eventsKey(room.code, room.round), since, -1)) || []).map((e) => JSON.parse(e)) : [];
    return send(res, 200, { room, events, now });
  }
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const body = await readJson(req);

  if (q.get("create") === "1") {
    const game = GAMES.includes(body.game) ? body.game : "tower";
    for (let i = 0; i < 5; i++) {
      const room = { code: newCode(), game, host: uid, players: [await player(uid, body.words)], status: "lobby", round: 0, seed: 0, startAt: 0, created: now, solo: !!body.solo };
      if (await redis("SET", roomKey(room.code), JSON.stringify(room), "EX", TTL, "NX")) {
        if (!room.solo) await redis("SADD", KEY_ROOMS, room.code);
        return send(res, 200, { room });
      }
    }
    throw httpError(500, "Не получилось создать комнату, попробуй ещё раз");
  }

  if (q.get("join")) {
    const room = await loadRoom(q.get("join").toUpperCase());
    const me = await player(uid, body.words);
    const k = room.players.findIndex((p) => p.uid === uid);
    if (k >= 0) room.players[k] = me;
    else if (room.solo) throw httpError(409, "Это одиночная игра");
    else if (room.players.length >= MAX_PLAYERS) throw httpError(409, "В комнате уже два игрока");
    else if (room.status === "playing") throw httpError(409, "Игра уже идёт — подожди конца раунда");
    else room.players.push(me);
    await saveRoom(room);
    return send(res, 200, { room });
  }

  if (q.get("start")) {
    const room = await loadRoom(q.get("start"));
    if (room.host !== uid) throw httpError(403, "Начать игру может только тот, кто создал комнату");
    Object.assign(room, { status: "playing", round: room.round + 1, seed: newSeed(), startAt: now + 3000 });
    await saveRoom(room);
    return send(res, 200, { room });
  }

  if (q.get("leave")) {
    const room = await loadRoom(q.get("leave"));
    room.players = room.players.filter((p) => p.uid !== uid);
    if (!room.players.length) {
      await redis("DEL", roomKey(room.code));
      await redis("SREM", KEY_ROOMS, room.code);
    }
    else {
      if (room.host === uid) room.host = room.players[0].uid;
      room.status = "lobby";
      await saveRoom(room);
    }
    return send(res, 200, { ok: true });
  }

  if (q.get("event")) {
    const room = await loadRoom(q.get("event"));
    if (!room.players.some((p) => p.uid === uid)) throw httpError(403, "Ты не в этой комнате");
    if (room.status !== "playing") throw httpError(409, "Игра не идёт");
    const type = ["kill", "hit", "end"].includes(body.type) ? body.type : null;
    if (!type) throw httpError(400, "Неизвестное событие");
    const ev = { type, id: Number(body.id) || 0, part: Number(body.part) || 0, by: uid, ts: now };
    if (type === "end") {
      room.status = "lobby";
      room.last = { round: room.round, result: body.result === "win" ? "win" : "lose" };
      await saveRoom(room);
    }
    const key = eventsKey(room.code, room.round);
    await redis("RPUSH", key, JSON.stringify(ev));
    await redis("EXPIRE", key, TTL);
    return send(res, 200, { ok: true, ts: now });
  }

  throw httpError(400, "Неизвестный запрос");
});
