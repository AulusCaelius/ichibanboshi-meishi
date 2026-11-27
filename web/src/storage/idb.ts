const DB_NAME = 'ichiban_local_studio_v2';
const DB_VERSION = 1;
const STORE_KV = 'kv_store';
const LS_PREFIX = 'ichiban_v2_';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbGet<T>(key: string, fallback: T): Promise<T> {
  const db = await openDb();
  if (db) {
    try {
      const val = await new Promise<T | undefined>((resolve) => {
        const tx = db.transaction(STORE_KV, 'readonly');
        const req = tx.objectStore(STORE_KV).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => resolve(undefined);
      });
      if (val !== undefined) return val;
    } catch {
      // Fallback to localStorage below
    }
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw) return JSON.parse(raw) as T;
    }
  } catch {
    // Ignore storage read failure
  }
  return fallback;
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    }
  } catch {
    // Quota exceeded on large custom artwork images in localStorage mirror is OK; IndexedDB holds large blobs
  }
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_KV, 'readwrite');
        tx.objectStore(STORE_KV).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Ignore IDB failure
    }
  }
}

export async function idbClearAll(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
      });
    }
  } catch {
    // ignore
  }
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_KV, 'readwrite');
        tx.objectStore(STORE_KV).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }
}
