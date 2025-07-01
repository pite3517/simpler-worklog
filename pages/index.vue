<template>
  <div>
    <div class="mb-4 flex justify-end gap-2">
      <ClientOnly>
        <!-- Fill from Calendar group -->
        <div class="flex items-center gap-1">
          <button
            class="btn btn-primary"
            :disabled="
              autoFilling || !hasCreds || calendarLoading || !hasStoredIcs
            "
            @click="confirmAutoFillFromCalendar"
          >
            <Icon name="lucide:calendar-plus" class="w-4 h-4" />
            Fill from Calendar
          </button>
        </div>
        <button
          class="btn btn-primary mr-8"
          title="How to use Fill from Calendar"
          @click="showCalInfo = true"
        >
          <Icon name="lucide:help-circle" class="w-4 h-4" />
        </button>
        <button
          class="btn btn-secondary"
          :disabled="autoFilling || !hasCreds || calendarLoading"
          @click="confirmAutoFill"
        >
          <Icon name="lucide:zap" class="w-4 h-4" />
          Auto-Fill Ceremonies (Sally)
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".ics"
          style="display: none"
          @change="handleFileSelect"
        >
      </ClientOnly>
    </div>
    <CalendarMonth ref="calRef" @day-selected="onDaySelected" />
    <WorklogModal
      :visible="showWorklog"
      :date="selectedDate"
      @close="showWorklog = false"
    />

    <dialog v-if="autoFilling" class="modal modal-open">
      <div class="modal-box flex flex-col items-center gap-4">
        <progress class="progress progress-primary w-full" />
        <p class="font-semibold">Auto-filling ceremonies…</p>
      </div>
    </dialog>

    <!-- Calendar Info Modal -->
    <dialog v-if="showCalInfo" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-2">How to use "Fill from Calendar"</h3>
        <ol class="list-decimal list-inside space-y-2 text-sm">
          <li>
            <strong>Export an .ics file from Google Calendar</strong><br >
            In Google Calendar, hover your calendar →
            <em>Settings &amp; sharing</em> → "Integrate calendar" →
            <em>Export</em>. Un-zip the download to get the *.ics* file.
          </li>
          <li>
            <strong>Upload the .ics file</strong><br >
            Open <em>Configure</em> → "Upload your calendar (.ics)" → select the
            file. The file is saved locally for future use.
          </li>
          <li>
            <strong>Configure title mappings</strong><br >
            Either pick a Team Preset or edit rows so event titles map to Jira
            issue keys.
          </li>
          <li>
            <strong>Run Fill from Calendar</strong><br >
            Back on the main view, click this button. The app logs matching
            events for the month to Jira, skipping duplicates.
          </li>
        </ol>

        <div class="modal-action mt-4">
          <button class="btn" @click="showCalInfo = false">Close</button>
        </div>
      </div>
      <form
        method="dialog"
        class="modal-backdrop"
        @submit.prevent="showCalInfo = false"
      >
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import CalendarMonth from "~/components/CalendarMonth.vue";
import WorklogModal from "~/components/WorklogModal.vue";
import { ref, computed } from "vue";
import { jiraFetch } from "~/composables/useJiraApi";
import { useWorklogStore } from "~/composables/useWorklogStore";
import { useToastStore } from "~/composables/useToastStore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { useJiraCredentials } from "~/composables/useJiraCredentials";
import { useCalendarLoading } from "~/composables/useCalendarLoading";
import { useCeremonyConfig } from "~/composables/useCeremonyConfig";
import ICAL from "ical.js";
import {
  loadIcsContent,
  saveIcsContent,
  storedIcs,
} from "~/composables/useIcsStorage";

// Extend dayjs with required plugins once
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);

// Set Thailand timezone as default
dayjs.tz.setDefault("Asia/Bangkok");

const selectedDate = ref(null);
const showWorklog = ref(false);
const autoFilling = ref(false);
const showCalInfo = ref(false);
const calRef = ref(null);
const fileInput = ref(null);

// Access global work-log store helpers
const { getLogs, fetchMonth, addHours, setLogs, markUpdated, getHours } =
  useWorklogStore();
const { addToast } = useToastStore();
const { configs: ceremonyConfigs } = useCeremonyConfig();

// Check if Jira credentials are present
const { email, token } = useJiraCredentials();
const hasCreds = computed(() => {
  // When rendering on the server we cannot access localStorage, so we assume
  // missing credentials to avoid prematurely enabling privileged controls.
  // The computed will re-evaluate on the client once hydrated.
  if (import.meta.server) return false;
  return !!email.value && !!token.value;
});

const hasStoredIcs = computed(() => {
  if (import.meta.server) return false;
  return !!storedIcs.value;
});

// Shared calendar loading flag
const { loading: calendarLoading } = useCalendarLoading();

function onDaySelected(date) {
  if (!hasCreds.value) return;
  selectedDate.value = date;
  showWorklog.value = true;
}

// ---------------- Auto-Fill Ceremonies -------------------------------------
function confirmAutoFill() {
  if (autoFilling.value || !hasCreds.value) return;
  const anchorDate = calRef.value?.getAnchor?.() ?? new Date();
  const monthLabel = dayjs(anchorDate).format("MMM YYYY");
  if (
    confirm(
      `This will automatically add ceremony worklogs for ${monthLabel}. This is the legacy method. Continue?`
    )
  ) {
    autoFillCeremonies();
  }
}

async function autoFillCeremonies() {
  autoFilling.value = true;
  const anchorDate = calRef.value?.getAnchor?.() ?? new Date();
  const monthStart = dayjs(anchorDate).startOf("month");
  const monthEnd = dayjs(anchorDate).endOf("month");

  try {
    // Ensure we have up-to-date cache before checking duplicates
    await fetchMonth(monthStart.toDate());

    const creations = [];
    const hoursByDay = {};
    const newLogsByDate = {};

    for (
      let d = monthStart.clone();
      d.isSameOrBefore(monthEnd, "day");
      d = d.add(1, "day")
    ) {
      const weekday = d.day(); // 0 = Sun .. 6 = Sat
      if (weekday === 0 || weekday === 6) continue; // skip weekends

      const tasks = ceremonyTasksForDate(d);
      if (tasks.length === 0) continue;

      const existing = getLogs(d.toDate());

      // Filter out duplicates first
      const toAdd = tasks.filter(
        (t) =>
          !existing.some(
            (l) =>
              l.issueKey === t.issueKey &&
              l.timeSpentSeconds === Math.round(t.hours * 3600)
          )
      );

      if (toAdd.length === 0) continue;

      const existingHours = existing.reduce(
        (s, l) => s + (l.timeSpentSeconds ?? 0) / 3600,
        0
      );
      const addHours = toAdd.reduce((s, t) => s + t.hours, 0);

      if (existingHours + addHours > 8) {
        // exceed 8h cap – skip whole day
        continue;
      }

      // Queue creations and track hours tally
      toAdd.forEach((t) => {
        creations.push({ date: d.toDate(), ...t });
        // Prepare container for merging later
        const keyLogs = dayjs(d).format("YYYY-MM-DD");
        if (!newLogsByDate[keyLogs]) newLogsByDate[keyLogs] = [];
        hoursByDay[keyLogs] = (hoursByDay[keyLogs] || 0) + t.hours;
      });
    }

    // Process creations in parallel batches of 20
    const batchSize = 20;
    for (let i = 0; i < creations.length; i += batchSize) {
      const batch = creations.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((item) => createWorklog(item.issueKey, item.hours, item.date))
      );
      results.forEach((resp, idx) => {
        const c = batch[idx];
        const iso = dayjs(c.date).format("YYYY-MM-DD");
        newLogsByDate[iso].push({
          id: resp?.id ?? "auto-" + Date.now() + "-" + idx,
          issueKey: c.issueKey,
          summary: "",
          timeSpentSeconds: Math.round(c.hours * 3600),
        });
      });
    }

    // Update local hours tally for immediate calendar highlight
    Object.entries(hoursByDay).forEach(([iso, hrs]) => {
      const dateObj = new Date(`${iso}T00:00:00`);
      const prevHours = getHours(dateObj);
      addHours(dateObj, hrs);
      const newHours = getHours(dateObj);
      // Trigger recent-update highlight for calendar cell using prev and new hours
      markUpdated(dateObj, prevHours, newHours);
    });

    // Merge newly created logs into central store so WorklogModal shows them immediately
    Object.entries(newLogsByDate).forEach(([iso, items]) => {
      const dateObj = new Date(`${iso}T00:00:00`);
      const merged = [...getLogs(dateObj), ...items];
      setLogs(dateObj, merged);
    });

    // Refresh store to include newly created logs so modal + duplicate checks stay in sync
    await fetchMonth(monthStart.toDate());

    addToast(
      `Ceremony worklogs have been added for ${monthStart.format("MMM YYYY")}.`,
      "success"
    );
  } catch (err) {
    console.error(err);
    addToast(
      "Failed to auto-fill ceremonies. See console for details.",
      "error"
    );
  } finally {
    autoFilling.value = false;
  }
}

function ceremonyTasksForDate(d) {
  const tasks = [{ issueKey: "ADM-6", hours: 1 }]; // All days
  const weekEven = d.isoWeek() % 2 === 0;
  const weekday = d.day();

  if (weekEven) {
    if (weekday === 2 || weekday === 4 || weekday === 5) {
      tasks.push({ issueKey: "ADM-17", hours: 0.25 });
    }
  } else {
    if (weekday === 1) {
      tasks.push({ issueKey: "ADM-17", hours: 0.25 });
      tasks.push({ issueKey: "ADM-18", hours: 0.5 });
      tasks.push({ issueKey: "ADM-19", hours: 1 });
    } else if (weekday === 2 || weekday === 4) {
      tasks.push({ issueKey: "ADM-17", hours: 0.25 });
    } else if (weekday === 5) {
      tasks.push({ issueKey: "ADM-17", hours: 0.25 });
      tasks.push({ issueKey: "ADM-20", hours: 1 });
      tasks.push({ issueKey: "ADM-16", hours: 1 });
      tasks.push({ issueKey: "ADM-18", hours: 1 });
    }
  }
  return tasks;
}

function createWorklog(issueKey, hours, dateObj) {
  const startedStr = dayjs(dateObj)
    .tz("Asia/Bangkok")
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0)
    .format("YYYY-MM-DDTHH:mm:ss.SSSZZ");

  const payload = {
    started: startedStr,
    timeSpentSeconds: Math.round(hours * 3600),
    comment: {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [] }],
    },
  };

  return jiraFetch(`rest/api/3/issue/${issueKey}/worklog`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------- Auto-Fill From Calendar ----------------------------------
/**
 * Parses .ics file content to extract calendar events within the specified date range.
 * @param {Date} start - The start of the date range.
 * @param {Date} end - The end of the date range.
 * @param {string} icsContent - The .ics file content to parse.
 * @returns {Promise<Array<{summary: string, start: {dateTime: string}, end: {dateTime: string}}>>} A promise that resolves to an array of calendar events.
 */
async function fetchCalendarEvents(start, end, icsContent = null) {
  if (!icsContent) {
    console.log("No .ics content provided");
    return [];
  }

  try {
    // Parse the .ics content
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);

    // Get all VEVENT components
    const vevents = comp.getAllSubcomponents("vevent");

    const events = [];
    const startDate = dayjs(start);
    const endDate = dayjs(end);

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      // Get event summary (title)
      const summary = event.summary || "Untitled Event";

      // Handle recurring events by expanding occurrences within range
      if (event.isRecurring()) {
        const iterator = event.iterator();
        let next = iterator.next();

        while (next) {
          const occStartDay = dayjs(next.toJSDate());

          // Stop iterating once we are past the desired end range
          if (occStartDay.isAfter(endDate, "day")) break;

          // Skip occurrences before the start range
          if (occStartDay.isBefore(startDate, "day")) {
            next = iterator.next();
            continue;
          }

          // Get full occurrence details (accounts for EXDATE, DTSTART/DTEND, etc.)
          const { startDate: occStart, endDate: occEnd } =
            event.getOccurrenceDetails(next);

          events.push({
            summary,
            start: { dateTime: occStart.toJSDate().toISOString() },
            end: { dateTime: occEnd.toJSDate().toISOString() },
          });

          next = iterator.next();
        }
        continue; // Skip standard processing for recurring master event
      }

      // Get start and end times for non-recurring (single) events
      const startTime = event.startDate;
      const endTime = event.endDate;

      if (!startTime || !endTime) continue;

      // Convert ICAL time to JavaScript Date
      const startJs = startTime.toJSDate();
      const endJs = endTime.toJSDate();

      // Check if event falls within the specified month range
      const eventStart = dayjs(startJs);
      const eventEnd = dayjs(endJs);

      // Include event if it overlaps with the target month
      if (
        eventStart.isBefore(endDate, "day") &&
        eventEnd.isAfter(startDate, "day")
      ) {
        events.push({
          summary: summary,
          start: {
            dateTime: startJs.toISOString(),
          },
          end: {
            dateTime: endJs.toISOString(),
          },
        });
      }
    }

    console.log(
      `Parsed ${events.length} events from .ics file for ${startDate.format(
        "MMM YYYY"
      )}`
    );

    return events;
  } catch (error) {
    console.error("Error parsing .ics file:", error);
    throw new Error(
      "Failed to parse .ics file. Please ensure it is a valid calendar file."
    );
  }
}

function confirmAutoFillFromCalendar() {
  if (autoFilling.value || !hasCreds.value) return;
  const anchorDate = calRef.value?.getAnchor?.() ?? new Date();
  const monthLabel = dayjs(anchorDate).format("MMM YYYY");

  // If stored ICS exists, offer to use it directly
  const storedIcs = loadIcsContent();
  if (storedIcs) {
    if (
      confirm(
        `Use previously stored calendar (.ics) data to fill worklogs for ${monthLabel}?\n` +
          "Press Cancel to select a new .ics file instead."
      )
    ) {
      autoFillFromCalendar(storedIcs);
      return;
    }
  }
  if (
    confirm(
      `This will parse calendar events from an .ics file for ${monthLabel} and log work based on your ceremony configuration. Please select an .ics file to continue.`
    )
  ) {
    // Trigger file input
    fileInput.value?.click();
  }
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.name.endsWith(".ics")) {
    addToast("Please select a valid .ics file.", "error");
    return;
  }

  try {
    const content = await readFileAsText(file);
    // Persist for future convenience
    saveIcsContent(String(content));
    await autoFillFromCalendar(String(content));
  } catch (err) {
    console.error("Error reading file:", err);
    addToast("Failed to read the .ics file.", "error");
  } finally {
    // Reset file input
    if (fileInput.value) {
      fileInput.value.value = "";
    }
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function autoFillFromCalendar(icsContent = null) {
  autoFilling.value = true;
  const anchorDate = calRef.value?.getAnchor?.() ?? new Date();
  const monthStart = dayjs(anchorDate).startOf("month");
  const monthEnd = dayjs(anchorDate).endOf("month");

  try {
    await fetchMonth(monthStart.toDate());
    const calendarEvents = await fetchCalendarEvents(
      monthStart.toDate(),
      monthEnd.toDate(),
      icsContent
    );

    const creations = [];
    const hoursByDay = {};
    const newLogsByDate = {};

    for (const event of calendarEvents) {
      if (!event.summary || !event.start?.dateTime || !event.end?.dateTime)
        continue;

      const eventTitle = event.summary.toLowerCase();
      const eventDate = dayjs(event.start.dateTime);

      const matchingConfig = ceremonyConfigs.value.find((c) =>
        eventTitle.includes(c.title.toLowerCase())
      );

      if (!matchingConfig) continue;

      const d = eventDate.startOf("day");
      const existing = getLogs(d.toDate());

      const startTime = dayjs(event.start.dateTime);
      const endTime = dayjs(event.end.dateTime);
      // Round to nearest 0.25 hour
      const hours = Math.round(endTime.diff(startTime, "minute") / 15) * 0.25;

      if (hours <= 0) continue;

      const toAdd = {
        issueKey: matchingConfig.issueKey,
        hours,
      };

      // Filter out duplicates
      const isDuplicate = existing.some(
        (l) =>
          l.issueKey === toAdd.issueKey &&
          l.timeSpentSeconds === Math.round(toAdd.hours * 3600)
      );
      if (isDuplicate) continue;

      const existingHours = existing.reduce(
        (s, l) => s + (l.timeSpentSeconds ?? 0) / 3600,
        0
      );
      if (existingHours + toAdd.hours > 8) {
        continue; // Skip day if it exceeds 8h cap
      }

      creations.push({ date: d.toDate(), ...toAdd });
      const keyLogs = d.format("YYYY-MM-DD");
      if (!newLogsByDate[keyLogs]) newLogsByDate[keyLogs] = [];
      hoursByDay[keyLogs] = (hoursByDay[keyLogs] || 0) + toAdd.hours;
    }

    // Process creations in parallel batches of 20
    const batchSize = 20;
    for (let i = 0; i < creations.length; i += batchSize) {
      const batch = creations.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((item) => createWorklog(item.issueKey, item.hours, item.date))
      );
      results.forEach((resp, idx) => {
        const c = batch[idx];
        const iso = dayjs(c.date).format("YYYY-MM-DD");
        newLogsByDate[iso].push({
          id: resp?.id ?? "auto-" + Date.now() + "-" + idx,
          issueKey: c.issueKey,
          summary: "",
          timeSpentSeconds: Math.round(c.hours * 3600),
        });
      });
    }

    // Update local hours tally for immediate calendar highlight
    Object.entries(hoursByDay).forEach(([iso, hrs]) => {
      const dateObj = new Date(`${iso}T00:00:00`);
      const prevHours = getHours(dateObj);
      addHours(dateObj, hrs);
      const newHours = getHours(dateObj);
      markUpdated(dateObj, prevHours, newHours);
    });

    // Merge newly created logs into central store so WorklogModal shows them immediately
    Object.entries(newLogsByDate).forEach(([iso, items]) => {
      const dateObj = new Date(`${iso}T00:00:00`);
      const merged = [...getLogs(dateObj), ...items];
      setLogs(dateObj, merged);
    });

    await fetchMonth(monthStart.toDate());

    addToast(
      `Worklogs from calendar events have been added for ${monthStart.format(
        "MMM YYYY"
      )}.`,
      "success"
    );
  } catch (err) {
    console.error(err);
    addToast(
      "Failed to auto-fill from calendar. See console for details.",
      "error"
    );
  } finally {
    autoFilling.value = false;
  }
}
</script>
