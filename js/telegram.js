// Telegram Mini App integration: theme colours, native back button, haptics, full height.
// Does nothing when the site is opened in a normal browser.
(function (App) {
  const tg = App.tg;
  if (!tg) return;
  const root = document.documentElement;
  root.classList.add("in-tg");
  tg.ready();
  tg.expand();
  if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); // swiping cards shouldn't close the app

  // Telegram's palette on top of our tokens; the rest follows its light/dark scheme.
  function applyTheme() {
    const p = tg.themeParams || {};
    const dark = tg.colorScheme === "dark";
    const set = (name, value) => { if (value) root.style.setProperty(name, value); };
    root.dataset.theme = dark ? "dark" : "light";
    set("--bg", p.secondary_bg_color || p.bg_color);
    set("--surface", p.section_bg_color || p.bg_color);
    set("--text", p.text_color);
    set("--muted", p.hint_color || p.subtitle_text_color);
    set("--accent", p.button_color);
    set("--on-accent", p.button_text_color);
    set("--surface-2", dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.045)");
    set("--border", dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)");
    set("--accent-soft", dark ? "rgba(120,150,255,.16)" : "rgba(59,91,219,.1)");
    set("--good", dark ? "#69db7c" : "#2b8a3e");
    set("--good-soft", dark ? "rgba(105,219,124,.15)" : "#e3f5e6");
    set("--bad", p.destructive_text_color || (dark ? "#ff8787" : "#c92a2a"));
    set("--bad-soft", dark ? "rgba(255,135,135,.15)" : "#fde8e8");
    root.style.colorScheme = dark ? "dark" : "light";
    if (tg.setHeaderColor && p.secondary_bg_color) tg.setHeaderColor(p.secondary_bg_color);
    if (tg.setBackgroundColor && p.secondary_bg_color) tg.setBackgroundColor(p.secondary_bg_color);
  }
  applyTheme();
  tg.onEvent("themeChanged", applyTheme);

  // Native back button instead of our ← arrow.
  const syncBack = () => {
    const home = !location.hash || location.hash === "#" || location.hash === "#home";
    home ? tg.BackButton.hide() : tg.BackButton.show();
  };
  tg.BackButton.onClick(() => { location.hash = ""; });
  window.addEventListener("hashchange", syncBack);
  document.addEventListener("DOMContentLoaded", syncBack);

  // Light vibration on right / wrong answers.
  const record = App.record;
  App.record = (w, ok) => {
    record(w, ok);
    try { tg.HapticFeedback.notificationOccurred(ok ? "success" : "error"); } catch (e) { /* old clients */ }
  };
})(window.App);
