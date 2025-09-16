import { ref, watch, readonly } from "vue";

// CeremonyDuration: Configuration for ceremony name and default duration
export interface CeremonyDuration {
  label: string;
  hours: number;
  issueKey: string;
}

const durationConfigKey = "ceremony-durations";

// Default ceremony durations (current hard-coded values)
const defaultDurations: CeremonyDuration[] = [
  { label: "Daily Stand-up", hours: 0.25, issueKey: "ADM-17" },
  { label: "Health Check", hours: 0.5, issueKey: "ADM-18" },
  { label: "Grooming", hours: 1, issueKey: "ADM-19" },
  { label: "Knowledge Sharing", hours: 1, issueKey: "ADM-20" },
  { label: "Planning", hours: 1, issueKey: "ADM-16" },
  { label: "Retrospective", hours: 1, issueKey: "ADM-18" },
];

// Global store state - initialize with defaults for SSR consistency
const ceremonyDurations = ref<CeremonyDuration[]>([...defaultDurations]);
let isInitialized = false;

// Store initialization
const initializeStore = () => {
  if (isInitialized) return;

  // On server, keep default values for consistency
  if (import.meta.server) {
    ceremonyDurations.value = [...defaultDurations];
    isInitialized = true;
    return;
  }

  const stored = localStorage.getItem(durationConfigKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        ceremonyDurations.value = parsed.map((c: any) => ({
          label: c.label || "",
          hours: typeof c.hours === 'number' ? c.hours : 1,
          issueKey: c.issueKey || "",
        }));
      } else {
        ceremonyDurations.value = [...defaultDurations];
      }
    } catch (error) {
      console.error(
        "Failed to parse ceremony duration config from localStorage:",
        error
      );
      ceremonyDurations.value = [...defaultDurations];
    }
  } else {
    ceremonyDurations.value = [...defaultDurations];
  }

  isInitialized = true;
};

// Auto-save when durations change
const saveToStorage = () => {
  if (import.meta.server) return;
  try {
    localStorage.setItem(durationConfigKey, JSON.stringify(ceremonyDurations.value));
  } catch (error) {
    console.error("Failed to save ceremony duration config to localStorage:", error);
  }
};

// Watch for changes and auto-save (only set up once globally)
if (!import.meta.server) {
  watch(ceremonyDurations, saveToStorage, { deep: true });
}

// Store actions
const updateDuration = (index: number, newDuration: Partial<CeremonyDuration>) => {
  initializeStore();
  if (index >= 0 && index < ceremonyDurations.value.length) {
    ceremonyDurations.value[index] = {
      ...ceremonyDurations.value[index],
      ...newDuration,
    };
  }
};

const addCeremony = (ceremony: CeremonyDuration) => {
  initializeStore();
  ceremonyDurations.value.push(ceremony);
};

const removeCeremony = (index: number) => {
  initializeStore();
  if (index >= 0 && index < ceremonyDurations.value.length) {
    ceremonyDurations.value.splice(index, 1);
  }
};

const setCeremonies = (ceremonies: CeremonyDuration[]) => {
  initializeStore();
  ceremonyDurations.value = ceremonies;
};

const resetToDefaults = () => {
  initializeStore();
  ceremonyDurations.value = [...defaultDurations];
};

const saveDurations = () => {
  saveToStorage();
};

// Client-side hydration function to load from localStorage after mount
const hydrateFromLocalStorage = () => {
  if (import.meta.server || isInitialized) return;
  
  const stored = localStorage.getItem(durationConfigKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        ceremonyDurations.value = parsed.map((c: any) => ({
          label: c.label || "",
          hours: typeof c.hours === 'number' ? c.hours : 1,
          issueKey: c.issueKey || "",
        }));
      }
    } catch (error) {
      console.error(
        "Failed to parse ceremony duration config from localStorage:",
        error
      );
    }
  }
  isInitialized = true;
};

// Store composable - provides access to the global store
export function useCeremonyDuration() {
  // Initialize store on first access
  initializeStore();

  return {
    ceremonyDurations: readonly(ceremonyDurations),
    updateDuration,
    addCeremony,
    removeCeremony,
    setCeremonies,
    resetToDefaults,
    saveDurations,
    hydrateFromLocalStorage,
  };
}
