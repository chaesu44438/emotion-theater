(function () {
    if (!window.storage) {
      window.storage = {
        async set(key, value) { localStorage.setItem(key, JSON.stringify({ value })); },
        async get(key) { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; },
        async list(prefix = "") {
          const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
          return { keys };
        },
        async del(key) { localStorage.removeItem(key); },
      };
    }
    // 필요 시 호출하는 no-op (이전 코드 호환용)
    window.ensureStorage = function ensureStorage () {};
  })();
  