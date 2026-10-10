// Course book material (Grammar Bank + Workbook) for the grammar section. Copyrighted, so it is not part of the
// site: the learner loads their own file once; it is cached in this browser and kept on the server behind their key
// (api/book.js), so other devices and the Telegram Mini App get it too.
(function (App) {
  let cache = App.store.get("book", null);

  const valid = (b) => b && b.units && typeof b.units === "object" && Object.keys(b.units).length > 0
    && Object.keys(b.units).every((u) => /^\d{1,2}[AB]$/.test(u));

  function keep(b) {
    cache = b;
    App.store.set("book", b);
    document.dispatchEvent(new CustomEvent("book-loaded"));
  }

  App.book = {
    get loaded() { return !!cache; },
    get meta() { return (cache && cache.meta) || {}; },
    unit(u) { return (cache && cache.units[u]) || null; },
    get count() { return cache ? Object.keys(cache.units).length : 0; },

    // Fresh copy from the server (another device may have uploaded it).
    async refresh() {
      if (!App.sync || !App.sync.connected) return false;
      const { book } = await App.sync.bookGet();
      if (book && valid(book)) { keep(book); return true; }
      return false;
    },

    async upload(file) {
      let book;
      try { book = JSON.parse(await file.text()); } catch (e) { throw new Error("Не получилось прочитать файл — это должен быть book.json"); }
      if (!valid(book)) throw new Error("Это не файл с материалами учебника");
      keep(book);
      if (App.sync && App.sync.connected) await App.sync.bookPut(book);
      return Object.keys(book.units).length;
    },

    forget() { cache = null; App.store.set("book", null); },
  };

  if (!cache) App.book.refresh().catch(() => {});
})(window.App);
