// Accounts: each one has its own progress, settings and Telegram chat (see api/_lib.js).
//   POST /api/auth                 body {login, password} → {token, uid, login, legacy, admin}
//                                  Sent from the Telegram Mini App (x-telegram-init-data) it also binds that Telegram
//                                  to the account, if the Telegram isn't bound to any account yet.
//   POST /api/auth?telegram=1      (x-telegram-init-data) sign in as the account this Telegram is bound to
//   GET  /api/auth                 (signed in) → {uid, login, admin}
//   POST /api/auth?logout=1        (signed in) ends this session
//   PUT  /api/auth?password=1      (signed in) body {old, password} — change your own password
// Admin only (ADMIN_UIDS in api/_lib.js):
//   GET  /api/auth?users=1         → {users: [{uid, login, telegram, admin}]}
//   POST /api/auth?create=1        body {login, password} — new account
//   PUT  /api/auth?reset=1         body {uid, password} — set a new password for an account
const {
  checkAuth, checkAdmin, isAdmin, verifyInitData, checkPassword, setPassword, createAccount, createSession, dropSession,
  getAccount, listUsers, chatOf, uidByChat, bindChat, readJson, send, handle, httpError, query,
} = require("./_lib");

const isWrite = (req) => req.method === "PUT" || req.method === "POST";

module.exports = handle(async (req, res) => {
  const q = query(req);
  const init = req.headers["x-telegram-init-data"];

  if (q.get("users") === "1") {
    await checkAdmin(req);
    const users = [];
    for (const uid of await listUsers()) {
      const acc = await getAccount(uid);
      users.push({ uid, login: (acc && acc.login) || uid, telegram: !!(await chatOf(uid)), admin: isAdmin(uid) });
    }
    users.sort((a, b) => a.login.localeCompare(b.login));
    return send(res, 200, { users });
  }

  if (q.get("create") === "1" && isWrite(req)) {
    await checkAdmin(req);
    const { login, password } = await readJson(req);
    return send(res, 200, { ok: true, uid: await createAccount(login, password) });
  }

  if (q.get("reset") === "1" && isWrite(req)) {
    await checkAdmin(req);
    const { uid, password } = await readJson(req);
    await setPassword(String(uid || ""), password);
    return send(res, 200, { ok: true });
  }

  if (q.get("telegram") === "1" && req.method === "POST") {
    const user = verifyInitData(init);
    if (!user) throw httpError(401, "Не удалось проверить вход через Telegram");
    const uid = await uidByChat(user.id);
    if (!uid) throw httpError(404, "Этот Telegram ещё не привязан к аккаунту");
    return send(res, 200, await createSession(uid));
  }

  if (q.get("logout") === "1" && req.method === "POST") {
    if (req.headers["x-session"]) await dropSession(req.headers["x-session"]);
    return send(res, 200, { ok: true });
  }

  if (q.get("password") === "1" && isWrite(req)) {
    const uid = await checkAuth(req);
    const body = await readJson(req);
    const acc = await getAccount(uid);
    await checkPassword(acc ? acc.login : uid, body.old);
    await setPassword(uid, body.password);
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET") {
    const uid = await checkAuth(req);
    const acc = await getAccount(uid);
    return send(res, 200, { uid, login: (acc && acc.login) || uid, admin: isAdmin(uid) });
  }

  if (req.method === "POST") {
    const { login, password } = await readJson(req);
    const acc = await checkPassword(login, password);
    // Signing in inside Telegram binds that Telegram, so reminders and voice recordings reach this account.
    const user = init && verifyInitData(init);
    if (user && !(await uidByChat(user.id))) await bindChat(acc.uid, user.id);
    return send(res, 200, await createSession(acc.uid));
  }
  throw httpError(405, "Method not allowed");
});
