// Simple month navigation + grid generator for a Sunday-first calendar.
import { computed, ref } from 'vue'

export interface CalendarDay {
  date: Date
  inCurrentMonth: boolean
  isWeekend: boolean
}

export function useCalendar (initial?: Date) {
  // The anchor date is always set to the first day of the month for simpler math.
  const anchor = ref(new Date(initial ?? new Date().setDate(1)))

  /** Go to previous month */
  function prevMonth () {
    const d = new Date(anchor.value)
    d.setMonth(d.getMonth() - 1)
    anchor.value = d
  }

  /** Go to next month */
  function nextMonth () {
    const d = new Date(anchor.value)
    d.setMonth(d.getMonth() + 1)
    anchor.value = d
  }

  const days = computed<CalendarDay[]>(() => {
    const firstDayOfMonth = new Date(anchor.value)
    const year = firstDayOfMonth.getFullYear()
    const month = firstDayOfMonth.getMonth()

    // Figure out how many days previous month spill we need (Sunday=0)
    const startWeekday = firstDayOfMonth.getDay()
    const daysBefore = startWeekday // 0..6

    // Number of days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Calculate the minimal number of weeks needed to display the current month
    // This is the total number of leading cells (daysBefore) plus the days in the month,
    // rounded up to the nearest multiple of 7. Result: 28, 35 or 42 cells (4–6 weeks).
    const totalCells = Math.ceil((daysBefore + daysInMonth) / 7) * 7
    const arr: CalendarDay[] = []
    for (let i = 0; i < totalCells; i++) {
      const dateOffset = i - daysBefore + 1 // +1 because dates start at 1
      const cellDate = new Date(year, month, dateOffset)
      const inCurrentMonth = cellDate.getMonth() === month
      const weekday = cellDate.getDay()
      arr.push({
        date: cellDate,
        inCurrentMonth,
        isWeekend: weekday === 0 || weekday === 6,
      })
    }
    return arr
  })

  return {
    anchor,
    days,
    prevMonth,
    nextMonth,
  }
} 