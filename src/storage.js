const DB_NAME = 'fargo-match-chart';
const STORE_NAME = 'app-state';
const STORAGE_PREFIX = 'fargo_';

let dbPromise = null;

const getDb = () => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const idbRequest = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const idbGet = async (key) => {
  const db = await getDb();
  return idbRequest(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key));
};

const idbSet = async (key, value) => {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(value, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbDelete = async (key) => {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbGetAllKeys = async () => {
  const db = await getDb();
  return idbRequest(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAllKeys());
};

export const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) {
    return false;
  }

  try {
    return await navigator.storage.persist();
  } catch (error) {
    console.warn('Could not request persistent storage:', error);
    return false;
  }
};

const readLocalStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`localStorage read failed for ${key}:`, error);
    return null;
  }
};

const writeLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`localStorage write failed for ${key}:`, error);
    return false;
  }
};

const removeLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`localStorage remove failed for ${key}:`, error);
  }
};

const isAppStorageKey = (key) => typeof key === 'string' && key.startsWith(STORAGE_PREFIX);

export const storageSet = (key, value) => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  writeLocalStorage(key, serialized);
  void idbSet(key, serialized).catch((error) => {
    console.warn(`IndexedDB write failed for ${key}:`, error);
  });
};

export const storageRemove = (key) => {
  removeLocalStorage(key);
  void idbDelete(key).catch((error) => {
    console.warn(`IndexedDB delete failed for ${key}:`, error);
  });
};

export const initStorage = async () => {
  await requestPersistentStorage();

  if (!window.indexedDB) {
    return;
  }

  try {
    const idbKeys = await idbGetAllKeys();
    for (const key of idbKeys) {
      if (!isAppStorageKey(key)) {
        continue;
      }

      const idbValue = await idbGet(key);
      if (idbValue == null) {
        continue;
      }

      const localValue = readLocalStorage(key);
      if (localValue === null) {
        writeLocalStorage(key, idbValue);
      }
    }

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!isAppStorageKey(key)) {
        continue;
      }

      const localValue = readLocalStorage(key);
      if (localValue !== null) {
        await idbSet(key, localValue);
      }
    }
  } catch (error) {
    console.warn('Storage sync failed:', error);
  }
};
