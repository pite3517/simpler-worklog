import { ref } from "vue";

const icsKey = "stored-ics-content";

// Reactive reference to current stored ICS text
export const storedIcs = ref<string | null>(
  import.meta.server ? null : localStorage.getItem(icsKey)
);

/**
 * Saves .ics raw text to localStorage.
 * @param content Raw text of the .ics file
 */
export function saveIcsContent(content: string) {
  if (import.meta.server) return;
  try {
    localStorage.setItem(icsKey, content);
    storedIcs.value = content;
  } catch (err) {
    console.error("Failed to save .ics content", err);
  }
}

/**
 * Loads previously saved .ics raw text, or null if none.
 */
export function loadIcsContent(): string | null {
  if (import.meta.server) return null;
  try {
    return storedIcs.value ?? localStorage.getItem(icsKey);
  } catch {
    return null;
  }
}

/**
 * Removes stored .ics content.
 */
export function clearIcsContent() {
  if (import.meta.server) return;
  localStorage.removeItem(icsKey);
  storedIcs.value = null;
}
