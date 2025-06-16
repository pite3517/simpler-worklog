<template>
  <!-- DaisyUI modal pattern using native <dialog> API -->
  <dialog ref="dlg" class="modal">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">Jira Credentials</h3>
        <button class="btn btn-ghost btn-sm" type="button" @click="clearCredentials">Clear</button>
      </div>

      <!-- Email input -->
      <div class="form-control">
        <label class="label">
          <span class="label-text">Email</span>
        </label>
        <input
          v-model="emailField"
          type="email"
          placeholder="you@lmwn.com"
          class="input input-bordered w-full"
          @keyup.enter="save"
        >
      </div>

      <!-- API token input with show/hide -->
      <div class="form-control mt-4">
        <label class="label">
          <span class="label-text">API Token</span>
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
          ><sup>?</sup></a>
        </label>
        <div class="flex items-center gap-2 w-full">
          <input
            v-model="tokenField"
            :type="showToken ? 'text' : 'password'"
            placeholder="API token"
            class="input input-bordered flex-grow min-w-0"
            @keyup.enter="save"
          >
          <button class="btn btn-square" type="button" @click="showToken = !showToken">
            <svg
              v-if="showToken"
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <!-- Eye-off icon: base eye + strike -->
              <!-- Diagonal strike -->
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
              <!-- Eye (same as unmask icon) -->
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <!-- Eye icon -->
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-action">
        <button class="btn" :disabled="loading" @click="emit('update:visible', false)">Cancel</button>
        <button
          class="btn btn-primary"
          :class="{ loading }"
          :disabled="loading"
          @click="save"
        >
          <span v-if="loading">Checking…</span>
          <span v-else>Save</span>
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useJiraCredentials } from '~/composables/useJiraCredentials'
import { useWorklogStore } from '~/composables/useWorklogStore'

const props = defineProps({
  visible: Boolean,
})
const emit = defineEmits(['update:visible'])

const { email, token } = useJiraCredentials()

const emailField = ref(email.value ?? '')
const tokenField = ref(token.value ?? '')
const showToken = ref(false)
const loading = ref(false)

const dlg = ref<HTMLDialogElement | null>(null)

// Access work-log store to purge cached data when creds are cleared
const { clearAll } = useWorklogStore()

watch(
  () => props.visible,
  (v) => {
    if (!dlg.value) return
    if (v) {
      // Reset local fields when the modal opens
      emailField.value = email.value ?? ''
      tokenField.value = token.value ?? ''
      if (!dlg.value.open) dlg.value.showModal()
    }
    else {
      // Modal closing – reset token visibility state
      showToken.value = false
      if (dlg.value.open) dlg.value.close()
    }
  },
  { immediate: true },
)

// Close event when clicking outside dialog
onMounted(() => {
  if (!dlg.value) return
  dlg.value.addEventListener('close', () => {
    emit('update:visible', false)
  })
})

async function save() {
  if (!emailField.value || !tokenField.value) {
    alert('Please enter both email and API token.')
    return
  }

  loading.value = true
  try {
    const res = await fetch('/api/jira/rest/api/3/myself', {
      headers: {
        Authorization: 'Basic ' + btoa(`${emailField.value}:${tokenField.value}`),
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Status ${res.status}`)
    }

    // If we reach here, credentials are valid
    email.value = emailField.value || null
    token.value = tokenField.value || null
    emit('update:visible', false)
  }
  catch (err) {
    console.error('Credential test failed', err)
    alert('Invalid Jira credentials. Please double-check your email and API token.')
  }
  finally {
    loading.value = false
  }
}

function clearCredentials() {
  if (!window.confirm('Clear stored Jira credentials?')) return
  email.value = null
  token.value = null
  emailField.value = ''
  tokenField.value = ''
  clearAll()
  emit('update:visible', false)
}
</script> 