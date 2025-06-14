import { reactive } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'error' | 'warn' | 'info' | 'cooldown'
  expiresAt?: number // epoch ms for auto-remove or countdown
}

const toasts = reactive<Toast[]>([])

function addToast(message: string, type: Toast['type'] = 'info', duration = 5000) {
  const id = Date.now() + Math.random()
  const toast: Toast = { id, message, type }
  if (duration > 0) toast.expiresAt = Date.now() + duration
  toasts.push(toast)
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }
}

function addCooldownToast(seconds: number) {
  const id = Date.now() + Math.random()
  const toast: Toast = {
    id,
    type: 'cooldown',
    message: '',
    expiresAt: Date.now() + seconds * 1000,
  }
  toasts.push(toast)
  const timer = setInterval(() => {
    if (!toast.expiresAt) return
    const remaining = toast.expiresAt - Date.now()
    if (remaining <= 0) {
      clearInterval(timer)
      removeToast(id)
    }
  }, 1000)
}

function removeToast(id: number) {
  const idx = toasts.findIndex(t => t.id === id)
  if (idx !== -1) toasts.splice(idx, 1)
}

export function useToastStore() {
  return { toasts, addToast, addCooldownToast, removeToast }
} 