<template>
  <div class="min-h-screen flex flex-col bg-base-100">
    <!-- Global background-save spinner fixed at top-right -->
    <span
      v-if="saving"
      class="fixed top-3 right-3 z-50 loading loading-spinner text-primary"
      title="Saving…"
    />

    <!-- Top navigation bar -->
    <div class="navbar bg-neutral text-neutral-content">
      <div class="flex-1 px-2 lg:flex-none">
        <span class="text-lg font-bold">Workly</span>
      </div>
      <div class="flex-none flex items-center gap-2">
        <button class="btn btn-soft btn-sm" :disabled="calendarLoading" @click="showAuthModal = true">
          <ClientOnly>
            <template #fallback>Set Token</template>
            <span v-if="token">Change Token</span>
            <span v-else>Set Token</span>
          </ClientOnly>
        </button>
      </div>
    </div>

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
import { onMounted, ref } from 'vue'
import { useJiraCredentials } from '~/composables/useJiraCredentials'
import AuthenticationModal from '~/components/AuthenticationModal.vue'
import ToastProvider from '~/components/ToastProvider.vue'
import { useCalendarLoading } from '~/composables/useCalendarLoading'
import { useSavingIndicator } from '~/composables/useSavingIndicator'

const { token } = useJiraCredentials()
const showAuthModal = ref(false)
const { loading: calendarLoading } = useCalendarLoading()
const { saving } = useSavingIndicator()

// On first client render, open modal if token is missing
onMounted(() => {
  if (!token.value) {
    showAuthModal.value = true
  }
})
</script> 