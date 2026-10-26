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
let queue = Promise.resolve();
let pending = 0;
export function persistBook(raw) {
  if (raw.length < 450000 && pending === 0) {
    localStorage.setItem(STORAGE_KEY, raw);
    return Promise.resolve("local");
  }
  pending++;
  // A pointer is changed only AFTER the durable transaction completes.
  queue = queue
    .catch(() => {})
    .then(async () => {
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
    })
    .finally(() => {
      pending--;
    });
  return queue;
}
