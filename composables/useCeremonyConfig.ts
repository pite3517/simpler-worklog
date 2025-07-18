import { ref, watch, readonly } from "vue";

// CeremonyConfig: Persistent mapping of title to issue key
export interface CeremonyConfig {
  title: string;
  issueKey: string;
}

// EventData: Calendar event with date and time tracking
export interface EventData {
  title: string;
  issueKey: string;
  dates: Array<{
    date: string; // YYYY-MM-DD format
    hours: number;
  }>;
}

const configKey = "ceremony-mappings";

const defaultConfig: CeremonyConfig[] = [
  { title: "Daily Standup", issueKey: "ADM-17" },
  { title: "Refinement", issueKey: "ADM-18" },
];

// Global store state
const configs = ref<CeremonyConfig[]>([]);
const eventData = ref<EventData[]>([]);
let isInitialized = false;

// Store initialization
const initializeStore = () => {
  if (isInitialized || import.meta.server) return;

  const stored = localStorage.getItem(configKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Migration: ensure array format
      if (Array.isArray(parsed)) {
        configs.value = parsed.map((c: any) => ({
          title: c.title || "",
          issueKey: c.issueKey || "",
        }));
      } else {
        // Convert old object format to array
        const migrated: CeremonyConfig[] = [];
        Object.entries(parsed).forEach(([title, issueKey]) => {
          migrated.push({ title, issueKey: issueKey as string });
        });
        configs.value = migrated;
      }
    } catch (error) {
      console.error(
        "Failed to parse ceremony config from localStorage:",
        error
      );
      configs.value = [...defaultConfig];
    }
  } else {
    configs.value = [...defaultConfig];
  }

  isInitialized = true;
};

// Auto-save when configs change
const saveToStorage = () => {
  if (import.meta.server) return;
  try {
    localStorage.setItem(configKey, JSON.stringify(configs.value));
  } catch (error) {
    console.error("Failed to save ceremony config to localStorage:", error);
  }
};

// Watch for changes and auto-save (only set up once globally)
if (!import.meta.server) {
  watch(configs, saveToStorage, { deep: true });
}

// Store actions
const addConfig = (config: CeremonyConfig) => {
  initializeStore();
  configs.value.push(config);
};

const removeConfig = (index: number) => {
  initializeStore();
  if (index >= 0 && index < configs.value.length) {
    configs.value.splice(index, 1);
  }
};

const setConfigs = (newConfigs: CeremonyConfig[]) => {
  initializeStore();
  configs.value = newConfigs;
};

const setEventData = (newEventData: EventData[]) => {
  eventData.value = newEventData;
};

const saveConfigs = () => {
  saveToStorage();
};

const loadConfigs = () => {
  initializeStore();
};

// Store composable - provides access to the global store
export function useCeremonyConfig() {
  // Initialize store on first access
  initializeStore();

  return {
    configs: readonly(configs), // Make configs readonly to prevent direct mutation
    eventData: readonly(eventData),
    addConfig,
    removeConfig,
    setConfigs,
    setEventData,
    saveConfigs,
    loadConfigs,
  };
}
