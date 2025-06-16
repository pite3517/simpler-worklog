<template>
  <div class="space-y-4">
    <!-- Navigation header -->
    <div class="flex items-center justify-between">
      <button class="btn btn-lg btn-ghost" @click="prevMonth">«</button>
      <h2 class="text-lg font-semibold">
        {{ monthName }} {{ anchor.getFullYear() }}
      </h2>
      <button class="btn btn-lg btn-ghost" @click="nextMonth">»</button>
    </div>

    <!-- Weekday headings -->
    <div class="grid grid-cols-7 text-center text-xs font-bold uppercase opacity-70">
      <span v-for="d in daysOfWeek" :key="d">{{ d }}</span>
    </div>

    <!-- Month grid -->
    <div class="relative grid grid-cols-7 auto-rows-fr gap-px bg-base-300 rounded-lg overflow-hidden">
      <div
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center bg-base-100/60 z-10"
      >
        <span class="loading loading-spinner text-primary"/>
      </div>
      <button
        v-for="day in days"
        :key="day.date.toISOString()"
        class="relative h-25 sm:h-30 w-full p-1 flex items-center justify-center border border-base-300"
        :class="cellClass(day)"
        :disabled="day.isWeekend || !hasCreds"
        @click="emit('day-selected', day.date)"
      >
        <span
          :class="[
            'absolute top-1 right-1 text-xs select-none',
            day.date.toDateString() === new Date().toDateString()
              ? 'bg-secondary text-secondary-content rounded-full w-5 h-5 flex items-center justify-center'
              : ''
          ]"
        >
          {{ day.date.getDate() }}
        </span>
        <span
          v-if="getHours(day.date) > 0 && getHours(day.date) < 8"
          class="m-auto text-sm font-semibold pointer-events-none"
        >
          {{ getHours(day.date).toFixed(2) }}
        </span>
        <!-- Sprint bar overlay (only on weekdays within a 2-week sprint window) -->
        <div
          v-if="getSprint(day.date)"
          :class="['absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center', sprintBarClass(day.date)]"
        >
          <span
            v-if="getSprint(day.date)?.showLabel"
            class="text-[10px] leading-none font-semibold text-white select-none"
          >
            {{ getSprint(day.date).display }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, watch } from 'vue'
import { useCalendar } from '~/composables/useCalendar'
import { useWorklogStore } from '~/composables/useWorklogStore'
import { useJiraCredentials } from '~/composables/useJiraCredentials'
import { useCalendarLoading } from '~/composables/useCalendarLoading'

// Declare emitted event in runtime string-array format
const emit = defineEmits(['day-selected'])

const { anchor, days, prevMonth, nextMonth } = useCalendar()
const { getHours, fetchMonth } = useWorklogStore()

// Disable calendar interactions until Jira credentials are set
const { email, token } = useJiraCredentials()
const hasCreds = computed(() => {
  if (import.meta.server)
    return true
  return !!email.value && !!token.value
})

// Use shared loading ref so other components can react to calendar fetch status
const { loading } = useCalendarLoading()

// NEW: fetch visible months once credentials are provided
watch(
  hasCreds,
  async (v, prev) => {
    if (!v || prev) return // trigger only when creds become available
    loading.value = true
    const months = []
    const seen = new Set()
    days.value.forEach(({ date }) => {
      const key = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`
      if (seen.has(key)) return
      seen.add(key)
      months.push(date)
    })
    try {
      await Promise.all(months.map((d) => fetchMonth(d)))
    } finally {
      loading.value = false
    }
  }
)

watch(
  days,
  async (list) => {
    loading.value = true
    const months = []
    const seen = new Set()
    list.forEach(({ date }) => {
      const key = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`
      if (seen.has(key)) return
      seen.add(key)
      months.push(date)
    })
    try {
      await Promise.all(months.map((d) => fetchMonth(d)))
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

const monthName = computed(() =>
  anchor.value.toLocaleString('en-US', { month: 'long' })
)

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Sprint configuration
const SPRINT_ANCHOR = new Date(2025, 0, 6) // 6 Jan 2025 (Monday) – Sprint 2501 start
const MS_PER_DAY = 86_400_000

function getSprint(date) {
  // Weekends never show the bar
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return null

  const diffDays = Math.floor((date.getTime() - SPRINT_ANCHOR.getTime()) / MS_PER_DAY)
  if (diffDays < 0) return null

  const sprintIndex = Math.floor(diffDays / 14) // each sprint spans 14 calendar days
  const posInSprint = diffDays % 14

  // Weekday positions inside the 2-week sprint (Mon–Fri, skip weekends 5 & 6 of each week)
  const isWeekdayInSprint =
    (posInSprint >= 0 && posInSprint <= 4) || // week 1 Mon–Fri
    (posInSprint >= 7 && posInSprint <= 11)   // week 2 Mon–Fri
  if (!isWeekdayInSprint) return null

  const isStart = posInSprint === 0
  const isEnd = posInSprint === 11

  const showLabel = posInSprint === 0 // label only on first Monday of the sprint

  // Build label YYNN (YY = last 2 digits of year, NN = sprint count in that year starting at 01)
  const year = date.getFullYear()
  // Derive first sprint index of the given year
  const firstMonday = new Date(year, 0, 1)
  const offset = (8 - firstMonday.getDay()) % 7 // days until first Monday (0-Sun .. 6-Sat)
  firstMonday.setDate(firstMonday.getDate() + offset)
  const indexOfFirstSprintThisYear = Math.floor((firstMonday.getTime() - SPRINT_ANCHOR.getTime()) / MS_PER_DAY / 14)
  const sprintNumberWithinYear = sprintIndex - indexOfFirstSprintThisYear + 1

  const label = `${year.toString().slice(-2)}${sprintNumberWithinYear.toString().padStart(2, '0')}`

  const display = `Sprint ${label}`
  return { label, display, isStart, isEnd, showLabel, index: sprintIndex }
}

function sprintBarClass(date) {
  const info = getSprint(date)
  if (!info) return ''
  const base = info.index % 2 === 0 ? 'bg-primary/50' : 'bg-accent/50'
  let cls = base
  if (info.isStart) cls += ' rounded-l-full'
  if (info.isEnd) cls += ' rounded-r-full'
  return cls
}

function cellClass(day) {
  // Highlight today with a ring utility
  const today = day.date.toDateString() === new Date().toDateString()
    ? '' // removed ring highlight; date number will handle highlighting
    : ''

  // Weekend cells remain non-clickable
  if (day.isWeekend) return `${today}bg-base-200 text-base-content/50 cursor-not-allowed`

  // Prefix for days outside the anchor month (dim the text)
  const extra = day.inCurrentMonth ? '' : 'text-base-content/30 '

  const hours = getHours(day.date)
  if (hours >= 8) return `${today}${extra}bg-success/20 hover:bg-success/30 cursor-pointer`
  if (hours > 0) return `${today}${extra}bg-warning/20 hover:bg-warning/30 cursor-pointer`

  // No worklogs yet
  return `${today}${extra}bg-base-100 hover:bg-primary/10 cursor-pointer`
}

function getAnchor() {
  return anchor.value
}

defineExpose({ getAnchor })
</script> 