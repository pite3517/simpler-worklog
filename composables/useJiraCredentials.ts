import { useStorage } from '@vueuse/core'
import type { Ref } from 'vue'

export interface JiraCredentials {
  email: Ref<string | null>
  token: Ref<string | null>
}

/**
 * Reactive wrapper around Jira e-mail + API token.
 * Values are persisted to localStorage so they survive reloads.
 */
export function useJiraCredentials(): JiraCredentials {
  // Keys are namespaced to avoid collisions with other apps sharing the domain.
  const email = useStorage<string | null>('jira-email', null)
  const token = useStorage<string | null>('jira-token', null)

  return { email, token }
} 