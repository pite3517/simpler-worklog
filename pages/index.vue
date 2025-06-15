<template>
  <div>
    <div class="mb-4 flex justify-end">
      <ClientOnly>
        <button class="btn btn-secondary" :disabled="autoFilling || !hasCreds || calendarLoading" @click="confirmAutoFill">
          Auto-Fill Ceremonies
        </button>
      </ClientOnly>
    </div>
    <CalendarMonth ref="calRef" @day-selected="onDaySelected" />
    <WorklogModal :visible="showWorklog" :date="selectedDate" @close="showWorklog = false" />

    <dialog v-if="autoFilling" class="modal modal-open">
      <div class="modal-box flex flex-col items-center gap-4">
        <progress class="progress progress-primary w-full" />
        <p class="font-semibold">Auto-filling ceremonies…</p>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import CalendarMonth from '~/components/CalendarMonth.vue'
import WorklogModal from '~/components/WorklogModal.vue'
import { ref, computed } from 'vue'
import { jiraFetch } from '~/composables/useJiraApi'
import { useWorklogStore } from '~/composables/useWorklogStore'
import { useToastStore } from '~/composables/useToastStore'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isoWeek from 'dayjs/plugin/isoWeek'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { useJiraCredentials } from '~/composables/useJiraCredentials'
import { useCalendarLoading } from '~/composables/useCalendarLoading'

// Extend dayjs with required plugins once
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)
dayjs.extend(isSameOrBefore)

const selectedDate = ref(null)
const showWorklog = ref(false)
const autoFilling = ref(false)
const calRef = ref(null)

// Access global work-log store helpers
const { getLogs, fetchMonth, addHours, setLogs } = useWorklogStore()
const { addToast } = useToastStore()

// Check if Jira credentials are present
const { email, token } = useJiraCredentials()
const hasCreds = computed(() => {
  // When rendering on the server we cannot access localStorage, so we assume
  // missing credentials to avoid prematurely enabling privileged controls.
  // The computed will re-evaluate on the client once hydrated.
  if (import.meta.server)
    return false
  return !!email.value && !!token.value
})

// Shared calendar loading flag
const { loading: calendarLoading } = useCalendarLoading()

function onDaySelected(date) {
  if (!hasCreds.value) return
  selectedDate.value = date
  showWorklog.value = true
}

// ---------------- Auto-Fill Ceremonies -------------------------------------
function confirmAutoFill () {
  if (autoFilling.value || !hasCreds.value) return
  const anchorDate = calRef.value?.getAnchor?.() ?? new Date()
  const monthLabel = dayjs(anchorDate).format('MMM YYYY')
  if (confirm(`This will automatically add ceremony worklogs for ${monthLabel}. Continue?`)) {
    autoFillCeremonies()
  }
}

async function autoFillCeremonies () {
  autoFilling.value = true
  const anchorDate = calRef.value?.getAnchor?.() ?? new Date()
  const monthStart = dayjs(anchorDate).startOf('month')
  const monthEnd = dayjs(anchorDate).endOf('month')

  try {
    // Ensure we have up-to-date cache before checking duplicates
    await fetchMonth(monthStart.toDate())

    const creations = []
    const hoursByDay = {}
    const newLogsByDate = {}

    for (let d = monthStart.clone(); d.isSameOrBefore(monthEnd, 'day'); d = d.add(1, 'day')) {
      const weekday = d.day() // 0 = Sun .. 6 = Sat
      if (weekday === 0 || weekday === 6) continue // skip weekends

      const tasks = ceremonyTasksForDate(d)
      if (tasks.length === 0) continue

      const existing = getLogs(d.toDate())

      // Filter out duplicates first
      const toAdd = tasks.filter(t => !existing.some(l => l.issueKey === t.issueKey && l.timeSpentSeconds === Math.round(t.hours * 3600)))

      if (toAdd.length === 0) continue

      const existingHours = existing.reduce((s,l)=> s + (l.timeSpentSeconds ?? 0)/3600, 0)
      const addHours = toAdd.reduce((s,t) => s + t.hours, 0)

      if (existingHours + addHours > 8) {
        // exceed 8h cap – skip whole day
        continue
      }

      // Queue creations and track hours tally
      toAdd.forEach(t => {
        creations.push({ date: d.toDate(), ...t })
        // Prepare container for merging later
        const keyLogs = dayjs(d).format('YYYY-MM-DD')
        if (!newLogsByDate[keyLogs]) newLogsByDate[keyLogs] = []
        hoursByDay[keyLogs] = (hoursByDay[keyLogs] || 0) + t.hours
      })
    }

    // Process creations in parallel batches of 10
    const batchSize = 10
    for (let i = 0; i < creations.length; i += batchSize) {
      const batch = creations.slice(i, i + batchSize)
      const results = await Promise.all(batch.map(item => createWorklog(item.issueKey, item.hours, item.date)))
      results.forEach((resp, idx) => {
        const c = batch[idx]
        const iso = dayjs(c.date).format('YYYY-MM-DD')
        newLogsByDate[iso].push({
          id: resp?.id ?? 'auto-' + Date.now() + '-' + idx,
          issueKey: c.issueKey,
          summary: '',
          timeSpentSeconds: Math.round(c.hours * 3600),
        })
      })
    }

    // Update local hours tally for immediate calendar highlight
    Object.entries(hoursByDay).forEach(([iso, hrs]) => {
      const dateObj = new Date(`${iso}T00:00:00`)
      addHours(dateObj, hrs)
    })

    // Merge newly created logs into central store so WorklogModal shows them immediately
    Object.entries(newLogsByDate).forEach(([iso, items]) => {
      const dateObj = new Date(`${iso}T00:00:00`)
      const merged = [...getLogs(dateObj), ...items]
      setLogs(dateObj, merged)
    })

    // Refresh store to include newly created logs so modal + duplicate checks stay in sync
    await fetchMonth(monthStart.toDate())

    addToast(`Ceremony worklogs have been added for ${monthStart.format('MMM YYYY')}.`, 'success')
  } catch (err) {
    console.error(err)
    addToast('Failed to auto-fill ceremonies. See console for details.', 'error')
  } finally {
    autoFilling.value = false
  }
}

function ceremonyTasksForDate (d) {
  const tasks = [ { issueKey: 'ADM-6', hours: 1 } ] // All days
  const weekEven = d.isoWeek() % 2 === 0
  const weekday = d.day()

  if (weekEven) {
    if (weekday === 2 || weekday === 4 || weekday === 5) {
      tasks.push({ issueKey: 'ADM-17', hours: 0.25 })
    }
  } else {
    if (weekday === 1) {
      tasks.push({ issueKey: 'ADM-17', hours: 0.25 })
      tasks.push({ issueKey: 'ADM-18', hours: 0.5 })
      tasks.push({ issueKey: 'ADM-19', hours: 1 })
    } else if (weekday === 2 || weekday === 4) {
      tasks.push({ issueKey: 'ADM-17', hours: 0.25 })
    } else if (weekday === 5) {
      tasks.push({ issueKey: 'ADM-17', hours: 0.25 })
      tasks.push({ issueKey: 'ADM-20', hours: 1 })
      tasks.push({ issueKey: 'ADM-16', hours: 1 })
      tasks.push({ issueKey: 'ADM-18', hours: 1 })
    }
  }
  return tasks
}

function createWorklog (issueKey, hours, dateObj) {
  const startedStr = dayjs(dateObj)
    .tz('Asia/Bangkok')
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0)
    .format('YYYY-MM-DDTHH:mm:ss.SSSZZ')

  const payload = {
    started: startedStr,
    timeSpentSeconds: Math.round(hours * 3600),
    comment: {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [] }],
    },
  }

  return jiraFetch(`rest/api/3/issue/${issueKey}/worklog`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
// --------------------------------------------------------------------------
</script> 