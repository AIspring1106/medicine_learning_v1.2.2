/*
 * database.js
 * 学習データ・画面設定を端末内(localStorage)に保存する共通窓口。
 * クイズ/暗記カードの既存履歴キーも読み出せるようにしてあります。
 * サーバー同期や端末間共有は行いません。
 */
(function () {
  'use strict';
  const PREFIX = 'medicine_learning_pwa_v1:';
  const memoryFallback = new Map();
  const rawMemoryFallback = new Map();

  function readRaw(key) {
    try {
      const value = window.localStorage.getItem(PREFIX + key);
      return value === null ? memoryFallback.get(key) ?? null : value;
    } catch (error) {
      return memoryFallback.get(key) ?? null;
    }
  }
  function writeRaw(key, value) {
    const serialized = JSON.stringify(value);
    memoryFallback.set(key, serialized);
    try { window.localStorage.setItem(PREFIX + key, serialized); } catch (error) { /* private mode fallback */ }
  }
  function parse(value, fallback) {
    if (value == null) return fallback;
    try { return JSON.parse(value); } catch (error) { return fallback; }
  }
  function readLegacy(key) {
    try { return parse(window.localStorage.getItem(key), []); }
    catch (error) { return []; }
  }

  window.AppDB = Object.freeze({
    get(key, fallback = null) { return parse(readRaw(key), fallback); },
    set(key, value) { writeRaw(key, value); return value; },
    remove(key) {
      memoryFallback.delete(key);
      try { window.localStorage.removeItem(PREFIX + key); } catch (error) { /* ignore */ }
    },
    getRaw(key) {
      try { const value = window.localStorage.getItem(key); return value === null ? rawMemoryFallback.get(key) ?? null : value; }
      catch (error) { return rawMemoryFallback.get(key) ?? null; }
    },
    setRaw(key, value) {
      const serialized = String(value); rawMemoryFallback.set(key, serialized);
      try { window.localStorage.setItem(key, serialized); } catch (error) { /* private mode fallback */ }
    },
    removeRaw(key) {
      rawMemoryFallback.delete(key);
      try { window.localStorage.removeItem(key); } catch (error) { /* ignore */ }
    },
    getSettings() { return this.get('settings', { dataText: '', patterns: null, bookmarkedOnly: false }); },
    saveSettings(settings) { return this.set('settings', settings); },
    getHistory() { return readLegacy('pharm_quiz_history_v2'); },
    getWrongRecords() {
      const current = readLegacy('pharm_quiz_recent_wrong_v1');
      return current.length ? current : readLegacy('pharm_quiz_wrong_log_v7');
    },
    getBookmarks() { return readLegacy('pharm_flashcards_bookmarks_v1'); }
  });
})();
