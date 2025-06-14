<template>
  <div class="min-h-screen flex flex-col bg-base-100">
    <!-- Top navigation bar -->
    <div class="navbar bg-neutral text-neutral-content">
      <div class="flex-1 px-2 lg:flex-none">
        <span class="text-lg font-bold">Simpler Worklog</span>
      </div>
      <div class="flex-none">
        <button class="btn btn-soft btn-sm" @click="showAuthModal = true">
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

const { token } = useJiraCredentials()
const showAuthModal = ref(false)

// On first client render, open modal if token is missing
onMounted(() => {
  if (!token.value) {
    showAuthModal.value = true
  }
})
</script> 