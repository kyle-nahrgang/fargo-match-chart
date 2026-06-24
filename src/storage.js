const DB_NAME = 'fargo-match-chart';
const STORE_NAME = 'app-state';
const STORAGE_PREFIX = 'fargo_';
const SW_STATE_CACHE = 'fargo-app-state-v1';
const SW_STATE_URL = '/__fargo_app_state__';

let dbPromise = null;
let pendingIdbWrites = new Set();
let swSyncTimer = null;

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

const isAppStorageKey = (key) => typeof key === 'string' && key.startsWith(STORAGE_PREFIX);

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

const collectLocalAppState = () => {
  const state = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (isAppStorageKey(key)) {
        state[key] = readLocalStorage(key);
      }
    }
  } catch (error) {
    console.warn('Failed to collect local app state:', error);
  }
  return state;
};

const applyStateMap = (state) => {
  if (!state || typeof state !== 'object') {
    return;
  }

  Object.entries(state).forEach(([key, value]) => {
    if (isAppStorageKey(key) && typeof value === 'string') {
      writeLocalStorage(key, value);
    }
  });
};

const waitForServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn('Service worker not ready:', error);
    return null;
  }
};

const loadStateFromServiceWorker = async () => {
  const registration = await waitForServiceWorker();
  const worker = registration?.active;
  if (!worker) {
    return null;
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), 1500);

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(event.data?.state ?? null);
    };

    worker.postMessage({ type: 'LOAD_STATE' }, [channel.port2]);
  });
};

const syncStateToServiceWorker = async () => {
  const registration = await waitForServiceWorker();
  const worker = registration?.active;
  if (!worker) {
    return;
  }

  worker.postMessage({
    type: 'SAVE_STATE',
    state: collectLocalAppState(),
  });
};

const scheduleServiceWorkerSync = () => {
  if (swSyncTimer) {
    window.clearTimeout(swSyncTimer);
  }

  swSyncTimer = window.setTimeout(() => {
    swSyncTimer = null;
    void syncStateToServiceWorker();
  }, 250);
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

export const storageGet = async (key) => {
  const localValue = readLocalStorage(key);
  if (localValue !== null) {
    return localValue;
  }

  if (window.indexedDB) {
    try {
      const idbValue = await idbGet(key);
      if (idbValue != null) {
        writeLocalStorage(key, idbValue);
        return idbValue;
      }
    } catch (error) {
      console.warn(`IndexedDB read failed for ${key}:`, error);
    }
  }

  return null;
};

export const storageSet = (key, value) => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  writeLocalStorage(key, serialized);

  if (window.indexedDB) {
    const writePromise = idbSet(key, serialized)
      .catch((error) => {
        console.warn(`IndexedDB write failed for ${key}:`, error);
      })
      .finally(() => {
        pendingIdbWrites.delete(writePromise);
      });
    pendingIdbWrites.add(writePromise);
  }

  scheduleServiceWorkerSync();
};

export const storageRemove = (key) => {
  removeLocalStorage(key);

  if (window.indexedDB) {
    const deletePromise = idbDelete(key)
      .catch((error) => {
        console.warn(`IndexedDB delete failed for ${key}:`, error);
      })
      .finally(() => {
        pendingIdbWrites.delete(deletePromise);
      });
    pendingIdbWrites.add(deletePromise);
  }

  scheduleServiceWorkerSync();
};

export const storageFlush = async () => {
  if (swSyncTimer) {
    window.clearTimeout(swSyncTimer);
    swSyncTimer = null;
  }

  if (pendingIdbWrites.size > 0) {
    await Promise.all([...pendingIdbWrites]);
  }

  await syncStateToServiceWorker();
};

export const initStorage = async () => {
  await requestPersistentStorage();

  const swState = await loadStateFromServiceWorker();
  if (swState) {
    applyStateMap(swState);
  }

  if (window.indexedDB) {
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

        if (readLocalStorage(key) === null) {
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
  }

  await syncStateToServiceWorker();
};

export const registerStorageLifecycleHooks = () => {
  const flush = () => {
    void storageFlush();
  };

  window.addEventListener('pagehide', flush);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  });
};

export const LAST_DIVISION_KEY = 'fargo_last_division_id';
