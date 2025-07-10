<template>
  <div class="min-h-screen flex flex-col bg-base-100">
    <!-- Global background-save spinner fixed at bottom-right -->
    <span
      v-if="saving"
      class="fixed bottom-3 right-3 z-50 loading loading-spinner text-primary"
      title="Saving…"
    />

    <!-- Top navigation bar -->
    <div class="navbar bg-neutral text-neutral-content">
      <div class="flex-1 px-2 lg:flex-none">
        <span class="text-lg font-bold">Workly</span>
      </div>
      <div class="ml-auto mr-2 flex items-center gap-2">
        <button class="btn btn-soft btn-sm" @click="showConfigModal = true">
          Configure
        </button>
        <button
          class="btn btn-soft btn-sm"
          :disabled="calendarLoading"
          @click="showAuthModal = true"
        >
          <ClientOnly>
            <template #fallback>Set Token</template>
            <span v-if="token">Change Token</span>
            <span v-else>Set Token</span>
          </ClientOnly>
        </button>
        <!-- Theme dropdown selector -->
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-soft btn-sm">Theme ▾</label>
          <ul
            tabindex="0"
            class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
          >
            <li v-for="theme in themes" :key="theme" class="text-base-content">
              <button
                class="capitalize flex items-center justify-between w-full"
                :data-set-theme="theme"
                data-act-class="active"
                :class="{ active: currentTheme === theme }"
                @click="currentTheme = theme"
              >
                <span>{{ theme }}</span>
                <svg
                  v-if="currentTheme === theme"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="3"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <CeremonyConfigModal
      :visible="showConfigModal"
      @close="showConfigModal = false"
    />

    <!-- Page slot -->
    <main class="flex-1 container mx-auto p-4">
      <slot />
    </main>

    <!-- Global authentication modal -->
    <AuthenticationModal v-model:visible="showAuthModal" />

    <!-- Toast provider -->
    <ToastProvider />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useJiraCredentials } from "~/composables/useJiraCredentials";
import AuthenticationModal from "~/components/AuthenticationModal.vue";
import ToastProvider from "~/components/ToastProvider.vue";
import { useCalendarLoading } from "~/composables/useCalendarLoading";
import { useSavingIndicator } from "~/composables/useSavingIndicator";
import { themeChange } from "theme-change";
import CeremonyConfigModal from "~/components/CeremonyConfigModal.vue";

const { token } = useJiraCredentials();
const showAuthModal = ref(false);
const { loading: calendarLoading } = useCalendarLoading();
const { saving } = useSavingIndicator();
const showConfigModal = ref(false);

const themes = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk",
];

// Track currently active theme so dropdown shows it as selected on load
const currentTheme = ref("");

// On first client render, open modal if token is missing
onMounted(() => {
  // Initialise theme-change for dropdown binding
  themeChange(false);

  // Set initial active theme based on html[data-theme] attribute
  if (typeof document !== "undefined") {
    currentTheme.value =
      document.documentElement.getAttribute("data-theme") ?? "light";
  }
  if (!token.value) {
    showAuthModal.value = true;
  }
});
</script>
