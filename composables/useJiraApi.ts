import { useJiraCredentials } from '~/composables/useJiraCredentials'
import { useToastStore } from '~/composables/useToastStore'

/**
 * Wrapper around fetch that routes through our `/api/jira` proxy and attaches Basic-auth header.
 */
export async function jiraFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { email, token } = useJiraCredentials()
  if (!email.value || !token.value) throw new Error('Jira credentials missing')

  const auth = btoa(`${email.value}:${token.value}`)
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Basic ${auth}`)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`/api/jira/${path.replace(/^\/+/, '')}`, {
    ...init,
    headers,
  })
  if (!res.ok) {
    const { addToast, addCooldownToast } = useToastStore()
    if (res.status === 429) {
      // Rate limit: read Retry-After header (seconds) fallback 60
      const retry = parseInt(res.headers.get('Retry-After') || '60', 10)
      addCooldownToast(retry)
    } else {
      addToast(`Jira request failed (${res.status})`, 'error')
    }
    throw new Error(`Jira API error ${res.status}`)
  }

  // Some endpoints (e.g., DELETE) may return 204 No Content
  if (res.status === 204) return undefined as unknown as T

  return res.json() as Promise<T>
} 