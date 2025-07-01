import { ref } from "vue";

const DB_NAME = "worklog-db";
const STORE_NAME = "ics-storage";
const DB_VERSION = 1;
const ICS_KEY = "calendar-ics";

// Reactive reference to current stored ICS text
export const storedIcs = ref<string | null>(null);

// Initialize DB and load stored content
async function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
}

// Load ICS content from IndexedDB
export async function loadIcsContent(): Promise<string | null> {
  if (import.meta.server) return null;

  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(ICS_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const content = request.result;
        storedIcs.value = content;
        resolve(content);
      };
    });
  } catch (err) {
    console.error("Failed to load .ics content from IndexedDB:", err);
    return null;
  }
}

// Save ICS content to IndexedDB
export async function saveIcsContent(content: string): Promise<void> {
  if (import.meta.server) return;

  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(content, ICS_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        storedIcs.value = content;
        resolve();
      };
    });
  } catch (err) {
    console.error("Failed to save .ics content to IndexedDB:", err);
  }
}

// Initialize by loading any stored content
if (!import.meta.server) {
  loadIcsContent().catch(console.error);
}

/**
 * Clears any stored .ics content
 */
export async function clearIcsContent(): Promise<void> {
  if (import.meta.server) return;

  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(ICS_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        storedIcs.value = null;
        resolve();
      };
    });
  } catch (err) {
    console.error("Failed to clear .ics content from IndexedDB:", err);
  }
}
