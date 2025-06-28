import { ref, watch, readonly } from "vue";

export interface CeremonyConfig {
  title: string;
  issueKey: string;
}

const configKey = "ceremony-mappings";

const defaultConfig: CeremonyConfig[] = [
  { title: "Daily Standup", issueKey: "ADM-17" },
  { title: "Refinement", issueKey: "ADM-18" },
];

// Global store state - similar to React context
const configs = ref<CeremonyConfig[]>([]);
let isInitialized = false;

// Store initialization
const initializeStore = () => {
  if (isInitialized || import.meta.server) return;

  const stored = localStorage.getItem(configKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Basic migration for users who had the old config with `hours`
      configs.value = parsed.map((c: any) => ({
        title: c.title,
        issueKey: c.issueKey,
      }));
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
    addConfig,
    removeConfig,
    setConfigs,
    saveConfigs,
    loadConfigs,
  };
}
