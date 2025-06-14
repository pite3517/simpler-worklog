<template>
  <div class="toast toast-top toast-end">
    <div
      v-for="t in toasts"
      :key="t.id"
      :class="['alert', 'shadow-lg', variantClass(t.type)]">
      <span v-if="t.type !== 'cooldown'">{{ t.message }}</span>
      <span v-else>Rate limited. Retry in {{ remaining(t) }}s</span>
      <button class="btn btn-xs btn-ghost ml-2" @click="remove(t.id)">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted, onUnmounted } from 'vue'
import { useToastStore } from '~/composables/useToastStore'

const { toasts, removeToast } = useToastStore()

const ticker = ref(Date.now())
let int
onMounted(() => {
  int = setInterval(() => {
    ticker.value = Date.now()
  }, 1000)
})
onUnmounted(() => clearInterval(int))

function variantClass(type) {
  switch (type) {
    case 'error':
      return 'alert-error'
    case 'warn':
      return 'alert-warning'
    case 'info':
      return 'alert-info'
    default:
      return 'alert-info'
  }
}

function remaining(t) {
  if (!t.expiresAt) return 0
  return Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 1000))
}

function remove(id) {
  removeToast(id)
}
</script> 