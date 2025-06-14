import { defineEventHandler, readBody, getMethod, getHeaders, H3Event } from 'h3'

// Base URL of your Jira instance (no trailing slash)
const JIRA_BASE = 'https://linemanwongnai.atlassian.net'

export default defineEventHandler(async (event: H3Event) => {
  // Extract the splat path segments and join them
  const raw = event.context.params?.path
  const targetPath = Array.isArray(raw) ? raw.join('/') : (raw || '')

  // Preserve original query string (e.g., ?maxResults=1000&startAt=0)
  const originalQuery = event.node.req.url?.split('?')[1] ?? ''
  const url = originalQuery
    ? `${JIRA_BASE}/${targetPath}?${originalQuery}`
    : `${JIRA_BASE}/${targetPath}`

  // Forward original method, headers, and body (if present)
  const method = getMethod(event) || 'GET'
  const incoming = getHeaders(event)

  const headers: HeadersInit = {
    // Forward auth & content-type if present
  }
  if (incoming['authorization']) headers['authorization'] = incoming['authorization'] as string
  if (incoming['content-type']) headers['content-type'] = incoming['content-type'] as string
  headers['accept'] = incoming['accept'] ?? 'application/json'

  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-Atlassian-Token'] = 'no-check'
  }

  const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(event)

  const response = await fetch(url, {
    method,
    headers,
    ...(body !== undefined && { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })

  event.res.statusCode = response.status
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'content-encoding') continue
    event.res.setHeader(key, value)
  }
  event.res.setHeader('Access-Control-Allow-Origin', '*')

  return response.body
})