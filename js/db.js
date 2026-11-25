// Minimal promise wrapper over IndexedDB. Every write is one atomic transaction.
import { STORES } from './logic/backup.js';

let opening;

function open() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('severe', 1);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        for (const name of STORES) db.createObjectStore(name, { keyPath: 'id' });
        const logs = request.transaction.objectStore('logs');
        logs.createIndex('exerciseId', 'exerciseId');
        logs.createIndex('date', 'date');
      }
    };
    request.onsuccess = () => {
      // Let a newer app version upgrade the database.
      request.result.onversionchange = () => { request.result.close(); location.reload(); };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
  return opening;
}

// Runs `work` inside a transaction and resolves once it has committed.
async function transact(mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, mode);
    const result = work((name) => tx.objectStore(name));
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

// { exercises: [...], templates: [...], ... } read in a single snapshot.
export async function readAll() {
  const requests = await transact('readonly', (store) => STORES.map((n) => store(n).getAll()));
  return Object.fromEntries(STORES.map((n, i) => [n, requests[i].result]));
}

// write({ logs: [log], exercises: [exercise] }, { sessions: [id] })
export const write = (puts = {}, deletes = {}) => transact('readwrite', (store) => {
  for (const [name, records] of Object.entries(puts)) records.forEach((r) => store(name).put(r));
  for (const [name, ids] of Object.entries(deletes)) ids.forEach((id) => store(name).delete(id));
});

// Replaces the whole database (first-launch seed, backup import). All or nothing.
export const replaceAll = (data) => transact('readwrite', (store) => {
  for (const name of STORES) {
    store(name).clear();
    data[name].forEach((record) => store(name).put(record));
  }
});
