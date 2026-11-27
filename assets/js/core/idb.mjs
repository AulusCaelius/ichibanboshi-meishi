/**
 * Browser IndexedDB Persistence Wrapper (`ichiban_prod_db`)
 * Removes 5MB localStorage quota caps for multi-work libraries,
 * high-resolution uploaded standee assets, and user custom templates.
 */

const DB_NAME = 'ichiban_prod_db';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('works')) {
          db.createObjectStore('works', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('custom_templates')) {
          db.createObjectStore('custom_templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : true);
      tx.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbGetAllWorks() {
  const rows = await withStore('works', 'readonly', (s) => s.getAll());
  return Array.isArray(rows) ? rows : null;
}

export async function idbPutWork(work) {
  if (!work || !work.id) return false;
  return Boolean(await withStore('works', 'readwrite', (s) => s.put(work)));
}

export async function idbDeleteWork(id) {
  return Boolean(await withStore('works', 'readwrite', (s) => s.delete(id)));
}

export async function idbGetCustomTemplates() {
  const rows = await withStore('custom_templates', 'readonly', (s) => s.getAll());
  return Array.isArray(rows) ? rows : [];
}

export async function idbPutCustomTemplate(tpl) {
  if (!tpl || !tpl.id) return false;
  return Boolean(await withStore('custom_templates', 'readwrite', (s) => s.put(tpl)));
}

export async function idbGetMeta(key) {
  const row = await withStore('meta', 'readonly', (s) => s.get(key));
  return row ? row.value : null;
}

export async function idbSetMeta(key, value) {
  return Boolean(await withStore('meta', 'readwrite', (s) => s.put({ key, value })));
}
