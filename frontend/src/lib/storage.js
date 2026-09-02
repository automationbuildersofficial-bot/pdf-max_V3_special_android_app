// On-device persistence: PDF bytes in IndexedDB, recent-file list in localStorage.
const DB_NAME = "pdfstudio";
const STORE = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putFile(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const rq = tx.objectStore(STORE).get(id);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

export async function deleteFile(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
  });
}

// --- full edit-state persistence (annotations, page order/rotation, sources) ---
export const putState = (id, state) => putFile(`state:${id}`, state);
export const getState = (id) => getFile(`state:${id}`);
export const deleteState = (id) => deleteFile(`state:${id}`);

const RKEY = "pdf_recents";

export function getRecents() {
  try {
    return JSON.parse(localStorage.getItem(RKEY) || "[]");
  } catch (e) {
    return [];
  }
}

export function addRecent(meta) {
  const list = getRecents().filter((r) => r.id !== meta.id);
  list.unshift(meta);
  const trimmed = list.slice(0, 20);
  localStorage.setItem(RKEY, JSON.stringify(trimmed));
  return trimmed;
}

export function removeRecent(id) {
  const list = getRecents().filter((r) => r.id !== id);
  localStorage.setItem(RKEY, JSON.stringify(list));
  return list;
}

export function updateRecent(id, patch) {
  const list = getRecents().map((r) => (r.id === id ? { ...r, ...patch } : r));
  localStorage.setItem(RKEY, JSON.stringify(list));
  return list;
}
