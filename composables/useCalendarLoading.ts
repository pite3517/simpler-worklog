import { ref } from 'vue'

// Shared reactive flag indicating whether calendar data (work-logs) is currently loading.
// Components across the app can import this composable to reactively read or mutate
// the loading status so that UI controls can be globally disabled while background
// work-log fetches are in progress.
const loading = ref(false)

export function useCalendarLoading () {
  return { loading }
} 