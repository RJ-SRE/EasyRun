import { STORAGE_KEY } from "./inscription-core.js";
const DB_NAME = "easyrun-word-memory",
  STORE = "books";
function database() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("词册数据库被另一窗口占用"));
  });
}
export async function loadLargeBook() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { raw: null, blocked: true };
  }
  if (!raw) return { raw: null };
  let pointer;
  try {
    pointer = JSON.parse(raw);
  } catch {
    return { raw };
  }
  if (pointer?.storage !== "indexeddb") return { raw };
  try {
    return await Promise.race([
      database().then(
        (db) =>
          new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readonly"),
              request = tx.objectStore(STORE).get("current");
            request.onsuccess = () => {
              db.close();
              if (typeof request.result !== "string")
                reject(new Error("缺少完整词册"));
              else resolve({ raw: request.result });
            };
            request.onerror = () => {
              db.close();
              reject(request.error);
            };
          }),
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("读取超时")), 3000),
      ),
    ]);
  } catch {
    return { raw: null, blocked: true, protect: true };
  }
}
export const RESET_KEY = STORAGE_KEY + "-reset-generation";
let generation;
try {
  generation = localStorage.getItem(RESET_KEY);
} catch {
  /* writes report unavailable */
}
const lock = (fn) =>
  window.navigator.locks
    ? window.navigator.locks.request("easyrun-inscription-storage", fn)
    : Promise.resolve().then(fn);
function assertCurrent() {
  if (localStorage.getItem(RESET_KEY) !== generation)
    throw new Error("另一窗口已清除记录，请刷新页面");
}
let queue = Promise.resolve();
export function persistBook(raw) {
  // A pointer is changed only AFTER the durable transaction completes.
  queue = queue
    .catch(() => {})
    .then(() =>
      lock(async () => {
        assertCurrent();
        if (raw.length < 450000) {
          localStorage.setItem(STORAGE_KEY, raw);
          return "local";
        }
        const db = await database();
        try {
          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put(raw, "current");
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error("保存被中断"));
          });
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ storage: "indexeddb", version: 2 }),
          );
          return "database";
        } finally {
          db.close();
        }
      }),
    );
  return queue;
}

// Serialize reset with this tab's queue and other tabs' durable writes. A reset
// generation is retained as a tombstone; older tabs cannot resurrect their book.
export function clearLocalGameRecords() {
  queue = queue
    .catch(() => {})
    .then(() =>
      lock(async () => {
        if (!window.navigator.locks)
          throw new Error("当前浏览器暂不支持安全清除，请使用新版 Chrome");
        const db = await database();
        try {
          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).delete("current");
            tx.oncomplete = resolve;
            tx.onabort = tx.onerror = () =>
              reject(tx.error || new Error("清除被中断"));
          });
          const next = crypto.randomUUID();
          localStorage.setItem(RESET_KEY, next);
          for (const key of [
            STORAGE_KEY,
            STORAGE_KEY + "-backup",
            STORAGE_KEY + "-before-import",
            "easyrun-belfry-v1",
            "easyrun-belfry-achievements-v1",
            "belfry-audio-v2",
            "easyrun-menu-reduced",
          ])
            localStorage.removeItem(key);
          sessionStorage.removeItem("belfry-resume");
        } finally {
          db.close();
        }
      }),
    );
  return queue;
}
