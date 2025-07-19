import { ref } from "vue";

// Reactive reference to current ICS text (session only, not persisted)
export const storedIcs = ref<string | null>(null);

/**
 * Set ICS content for current session only (not persisted)
 */
export function setIcsContent(content: string): void {
  storedIcs.value = content;
}

/**
 * Clear current session ICS content
 */
export function clearIcsContent(): void {
  storedIcs.value = null;
}

/**
 * Get current session ICS content
 */
export function getIcsContent(): string | null {
  return storedIcs.value;
}
