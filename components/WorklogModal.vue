<template>
  <dialog ref="dlg" class="modal" @click.self="attemptClose">
    <div class="modal-box w-full max-w-3xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">Worklogs – {{ isoDate }}</h3>
        <span class="text-xl font-semibold">{{ totalHours.toFixed(2) }}h</span>
      </div>

      <!-- Existing logs table -->
      <div v-if="loading" class="flex items-center justify-center py-10">
        <span class="loading loading-spinner text-primary" />
      </div>
      <template v-else>
        <p v-if="displayedLogs.length === 0" class="text-sm opacity-60">
          No worklogs for this day.
        </p>

        <div v-else class="overflow-x-auto">
          <table class="table table-zebra table-sm w-full">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Summary</th>
                <th class="text-right">Time (h)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="log in displayedLogs"
                :key="log.id"
                :class="['transition-colors', log.isNew ? '!bg-info/20' : '']"
              >
                <td>{{ log.issueKey }}</td>
                <td>{{ log.summary }}</td>
                <td class="text-right">
                  {{ ((log.timeSpentSeconds ?? 0) / 3600).toFixed(2) }}
                </td>
                <td class="w-14 text-right">
                  <button class="btn btn-xs btn-ghost" @click="onDelete(log)">
                    🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Sprint Ceremonies presets -->
      <div class="mt-6 space-y-2">
        <h4 class="font-semibold text-sm">Ceremonies</h4>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in presets"
            :key="p.key"
            class="btn btn-xs btn-outline"
            @click="onPreset(p)"
          >
            {{ p.label }}
          </button>
        </div>

        <!-- Common Presets -->
        <h4 class="font-semibold text-sm mt-4">Common</h4>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in commonPresets"
            :key="c.issueKey"
            class="btn btn-xs btn-outline"
            @click="onCommonPreset(c)"
          >
            {{ c.label }}
          </button>
        </div>

        <h4 class="font-semibold text-sm mt-4">My Active Issues</h4>
        <ul class="border rounded max-h-48 overflow-y-auto mb-2 text-sm">
          <li
            v-for="iss in activeIssues"
            :key="iss.key"
            class="px-2 py-1 cursor-pointer hover:bg-base-200 flex gap-2"
            @click="onIssueSelect(iss)"
          >
            <span class="font-mono font-semibold">{{ iss.key }}</span>
            <span class="truncate">{{ iss.summary }}</span>
          </li>
        </ul>
        <div v-if="issuesTotal > pageSize" class="flex justify-end gap-2">
          <button
            class="btn btn-xs"
            :disabled="pageStart === 0"
            @click="prevPage"
          >
            Prev
          </button>
          <button
            class="btn btn-xs"
            :disabled="pageStart + pageSize >= issuesTotal"
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </div>

      <!-- Manual Add -->
      <div class="mt-6">
        <h4 class="font-semibold text-sm mb-2">Manual Add</h4>
        <div class="flex items-center gap-2 flex-wrap">
          <input
            v-model="issueInput"
            type="text"
            placeholder="LM-xxxxx or URL"
            class="input input-sm input-bordered flex-1 min-w-40"
            @keyup.enter.prevent="addManual"
            @paste="onPasteIssue"
          >
          <div class="flex items-center gap-1">
            <button class="btn btn-xs" @click="bump(-1)">-1h</button>
            <button class="btn btn-xs" @click="bump(-0.5)">-30m</button>
            <span class="font-mono text-md w-14 text-center text-primary font-semibold"
              >{{ duration.toFixed(2) }}h</span
            >
            <button class="btn btn-xs" @click="bump(0.5)">+30m</button>
            <button class="btn btn-xs" @click="bump(1)">+1h</button>
          </div>
          <button class="btn btn-sm btn-primary" @click="addManual">Add</button>
        </div>
        <p v-if="manualError" class="text-error text-xs mt-1">
          {{ manualError }}
        </p>
        <p
          class="text-xs opacity-80 mt-1 truncate h-5"
          :style="{ visibility: searchedIssue && !manualError ? 'visible' : 'hidden' }"
        >
          {{ searchedIssue ? searchedIssue.summary : '' }}
        </p>
        <ul
          v-if="suggestions.length"
          class="border rounded mt-2 max-h-48 overflow-y-auto text-sm"
        >
          <li
            v-for="s in suggestions"
            :key="s.key"
            class="px-2 py-1 cursor-pointer hover:bg-base-200 flex gap-2"
            @click="onSuggestion(s)"
          >
            <span class="font-mono font-semibold">{{ s.key }}</span>
            <span class="truncate">{{ s.summary }}</span>
          </li>
        </ul>
      </div>

      <div class="modal-action flex justify-end gap-2">
        <button class="btn btn-primary" :disabled="!unsaved" @click="saveChanges">Save</button>
        <button class="btn" @click="attemptClose">Close</button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, watch, onMounted, computed, toRefs, onBeforeUnmount, reactive } from "vue";
import { jiraFetch } from "~/composables/useJiraApi";
import { useWorklogStore } from "~/composables/useWorklogStore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import debounce from "lodash.debounce";

// Initialise Day.js with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

const props = defineProps(["visible", "date"]);
const emit = defineEmits(["close"]);

const { visible } = toRefs(props);
const dlg = ref(null);
const loading = ref(false);
const logs = ref([]);
const issueInput = ref("");
const duration = ref(1);
const manualError = ref("");
const unsaved = ref(false);

// Active issues pagination state
const activeIssues = ref([]);
const issuesTotal = ref(0);
const pageStart = ref(0);
const pageSize = 10;

// Central work-log cache
const { getLogs, fetchMonth, setLogs } = useWorklogStore();

// Manual issue search state
const searchedIssue = ref(null);
const searchLoading = ref(false);
const suggestions = ref([]);
const skipNextLookup = ref(false);

// Map of issueKey -> real Jira summary (fetched once on mount)
const presetSummaries = reactive({});

// Debounced lookup function using lodash.debounce (500 ms)
const debouncedLookup = debounce(async (term) => {
  searchLoading.value = true;
  suggestions.value = [];
  try {
    const keyMatch = parseIssueKey(term);
    if (keyMatch && keyMatch === term.toUpperCase()) {
      // Exact key pattern – try direct fetch
      const data = await jiraFetch(`rest/api/3/issue/${keyMatch}?fields=summary`);
      searchedIssue.value = { key: data.key, summary: data.fields.summary };
      manualError.value = "";
    } else {
      // Generic search for suggestions (top 10)
      const body = {
        jql: `text ~ "${term}*" ORDER BY updated DESC`,
        fields: ["summary"],
        maxResults: 10,
      };
      const res = await jiraFetch("rest/api/3/search", {
        method: "POST",
        body: JSON.stringify(body),
      });
      suggestions.value =
        res.issues?.map((i) => ({ key: i.key, summary: i.fields.summary })) ?? [];
      // Reset single search result until exact key chosen
      searchedIssue.value = null;
    }
  } catch {
    searchedIssue.value = null;
    manualError.value = "Issue not found";
  } finally {
    searchLoading.value = false;
  }
}, 300);

// Compute the selected calendar day in a time-zone-agnostic way. We purposely
// avoid converting with .tz() here, because the incoming `props.date` is
// already a local-midnight value from the calendar component. Converting it
// again may shift the date when the browser runs in a different zone.  
// By formatting immediately we keep only the plain `YYYY-MM-DD` portion,
// which is what we use for equality checks below.
const isoDate = computed(() =>
  props.date ? dayjs(props.date).format("YYYY-MM-DD") : ""
);

const displayedLogs = computed(() => logs.value.filter(l => !l.deleted));

const totalHours = computed(() => currentTotalHours());

watch(
  () => props.visible,
  async (v) => {
    if (!dlg.value) return;
    if (v && props.date) {
      if (!dlg.value.open) dlg.value.showModal();
      await fetchLogs();
    } else if (!v) {
      if (dlg.value.open) dlg.value.close();
      resetModalState();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (!dlg.value) return;
  dlg.value.addEventListener("close", () => emit("close"));
  if (visible.value && !dlg.value.open) {
    dlg.value.showModal();
  }
  prefetchPresetSummaries();
});

async function fetchLogs() {
  loading.value = true;
  logs.value = [];
  try {
    // 1) Try cache first
    const cached = getLogs(props.date);
    if (cached.length) {
      // Clone each log item so local edits do not mutate the central store
      logs.value = cached.map((l) => ({ ...l }));
      await fillMissingSummaries();
      return;
    }

    // 2) Cache miss – pre-fetch the whole month once then read again
    await fetchMonth(props.date);
    // Deep-copy again after refetch to keep local state isolated
    logs.value = getLogs(props.date).map((l) => ({ ...l }));
    await fillMissingSummaries();
  } catch {
    console.error();
  } finally {
    loading.value = false;
    unsaved.value = false;
  }
}

// Static preset definitions
const presets = [
  { label: "Daily Stand-up",  hours: 0.25, issueKey: "ADM-17" },
  { label: "Health Check",    hours: 0.5,  issueKey: "ADM-18" },
  { label: "Daily General Admin", hours: 1, issueKey: "ADM-6" },
  { label: "Grooming",         hours: 1, issueKey: "ADM-19" },
  { label: "Knowledge Sharing", hours: 1, issueKey: "ADM-20" },
  { label: "Planning",         hours: 1, issueKey: "ADM-16" },
  { label: "Retrospective",    hours: 1, issueKey: "ADM-18" },
  { label: "Holiday",          hours: 8, issueKey: "ADM-1" },
];

// Common presets that pre-fill manual section (no immediate add)
const commonPresets = [
  { label: 'Annual Leave', issueKey: 'ADM-2', defaultHours: 8 },
  { label: 'Sick Leave', issueKey: 'ADM-3', defaultHours: 8 },
  { label: 'General Admin', issueKey: 'ADM-6', defaultHours: 1 },
  { label: 'Training', issueKey: 'ADM-7', defaultHours: 8 },
  { label: 'Recruitment / Interview / Public Speaker', issueKey: 'ADM-9', defaultHours: 1 },
  { label: 'Release Support / On Call', issueKey: 'ADM-10', defaultHours: 1 },
  { label: 'General Meetings', issueKey: 'ADM-13', defaultHours: 1 },
];

async function prefetchPresetSummaries() {
  if (import.meta.server) return;
  await Promise.all(
    [...presets, ...commonPresets]
      .filter((p) => p.issueKey)
      .map(async (p) => {
        try {
          if (presetSummaries[p.issueKey]) return;
          const data = await jiraFetch(`rest/api/3/issue/${p.issueKey}?fields=summary`);
          presetSummaries[p.issueKey] = data.fields.summary;
        } catch {
          /* ignore fetch errors */
        }
      })
  );
}

async function loadActiveIssues() {
  try {
    const body = {
      jql: "assignee = currentUser() AND statusCategory != Done AND (sprint in openSprints() OR sprint in futureSprints()) ORDER BY updated DESC",
      fields: ["summary"],
      maxResults: pageSize,
      startAt: pageStart.value,
    };
    const data = await jiraFetch("rest/api/3/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    activeIssues.value =
      data.issues?.map((i) => ({ key: i.key, summary: i.fields.summary })) ??
      [];
    issuesTotal.value = data.total ?? activeIssues.value.length;
  } catch (err) {
    console.error(err);
  }
}

function prevPage() {
  pageStart.value = Math.max(0, pageStart.value - pageSize);
  loadActiveIssues();
}

function nextPage() {
  if (pageStart.value + pageSize < issuesTotal.value) {
    pageStart.value += pageSize;
    loadActiveIssues();
  }
}

function createWorklog(issueKey, hours, startedIso) {
  const started = dayjs(props.date)
    .tz('Asia/Bangkok')
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0)
    .format('YYYY-MM-DD') // base date part

  const startedStr = startedIso ?? dayjs(started)
    .tz('Asia/Bangkok')
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

async function onPreset(preset) {
  if (!preset.issueKey) {
    // Need issue key – prompt user via manual section
    issueInput.value = ''
    duration.value = preset.hours
    manualError.value = 'Select an issue key for "' + preset.label + '"'
    return
  }

  if (isWeekendDay(props.date)) {
    manualError.value = 'Cannot log work on weekend'
    return
  }

  const remain = remainingHours();
  if (remain <= 0) {
    manualError.value = 'Reached 8h limit';
    return;
  }

  manualError.value = '';

  const hoursToAdd = Math.min(preset.hours, remain);
  const summary = preset.issueKey ? (presetSummaries[preset.issueKey] || preset.label) : preset.label;

  logs.value.push({
    id: 'tmp-' + Date.now(),
    issueKey: preset.issueKey,
    summary,
    timeSpentSeconds: parseFloat(hoursToAdd.toFixed(2)) * 3600,
    isNew: true,
  })
  unsaved.value = true;
}

function onIssueSelect(issue) {
  manualError.value = '';
  issueInput.value = issue.key;
  searchedIssue.value = { key: issue.key, summary: issue.summary };
  skipNextLookup.value = true;
  // Reset duration to 1h as default, user can adjust via chips
  duration.value = 1;
  // Clear suggestions to avoid confusion
  suggestions.value = [];
  // Focus could be handled by ref but omitted here for brevity
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      pageStart.value = 0;
      loadActiveIssues();
    }
  }
);

function onDelete(log) {
  // Mark for deletion or remove if it is newly added in this session
  if (log.isNew) {
    logs.value = logs.value.filter((l) => l !== log)
  } else {
    log.deleted = !log.deleted
  }
  unsaved.value = logs.value.some(l => l.isNew || l.deleted);
}

function onSuggestion(issue) {
  issueInput.value = issue.key;
  searchedIssue.value = { key: issue.key, summary: issue.summary };
  skipNextLookup.value = true;
  suggestions.value = [];
}

function onPasteIssue(e) {
  const text = e.clipboardData?.getData('text')?.trim() ?? '';
  const key = parseIssueKey(text);
  if (key) {
    e.preventDefault();
    issueInput.value = key;
    searchedIssue.value = null;
    skipNextLookup.value = false;
    debouncedLookup(key); // trigger lookup immediately
  }
}

// --- Utility helpers & actions -------------------------------------------------

function bump(delta) {
  // Adjust duration in 0.5-hour granularity, floor at 0.5, cap at 8
  const remaining = remainingHours();
  if (remaining <= 0) return;
  const nextRaw = duration.value + delta;
  const next = Math.round(nextRaw * 2) / 2; // keep 0.5 steps for buttons
  const capped = Math.min(Math.max(next, 0.5), remaining);
  duration.value = parseFloat(capped.toFixed(2));
}

function remainingHours() {
  return Math.max(0, 8 - currentTotalHours());
}

function parseIssueKey(input) {
  // Accept plain key (ABC-123) or any Jira URL containing the key
  const KEY_RE = /([A-Z][A-Z0-9]+-\d+)/
  const m = input.toUpperCase().match(KEY_RE)
  return m ? m[1] : null
}

// Lookup whenever the manual issue input changes (debounced)
watch(issueInput, (val) => {
  if (skipNextLookup.value) {
    skipNextLookup.value = false;
    return;
  }
  searchedIssue.value = null;
  manualError.value = "";
  suggestions.value = [];

  const key = parseIssueKey(val.trim());
  if (!key && val.trim().length < 2) {
    searchLoading.value = false;
    debouncedLookup.cancel();
    return;
  }

  debouncedLookup(val.trim());
});

onBeforeUnmount(() => {
  debouncedLookup.cancel();
});

async function addManual() {
  const key = parseIssueKey(issueInput.value.trim())
  if (!key) {
    manualError.value = 'Enter a valid Jira issue key (e.g. LM-xxxxx) or URL'
    return
  }

  // Ensure the searchedIssue matches and exists
  if (!searchedIssue.value || searchedIssue.value.key !== key) {
    manualError.value = 'Issue not found'
    return
  }

  if (isWeekendDay(props.date)) {
    manualError.value = 'Cannot log work on weekend'
    return
  }

  let hoursToAdd = duration.value;
  const remain = remainingHours();
  if (hoursToAdd > remain) hoursToAdd = remain;
  if (hoursToAdd <= 0) {
    manualError.value = 'Reached 8h limit';
    return;
  }

  logs.value.push({
    id: 'tmp-' + Date.now(),
    issueKey: key,
    summary: searchedIssue.value.summary ?? '',
    timeSpentSeconds: parseFloat(hoursToAdd.toFixed(2)) * 3600,
    isNew: true,
  })

  // Reset input & duration UI
  issueInput.value = ''
  duration.value = 1

  unsaved.value = true;
}

// ------------------- Save / Close handling -----------------------------------

async function saveChanges() {
  loading.value = true
  try {
    // Business rules ---------------------------------------------------------
    if (isWeekendDay(props.date)) {
      alert('Cannot log work on weekend')
      return
    }

    const totalHours = currentTotalHours()
    if (totalHours > 8) {
      alert('Total hours exceed 8h limit')
      return
    }
    if (totalHours < 8) {
      if (!confirm('Total hours < 8h. Proceed anyway?')) {
        return
      }
    }

    const createOps = logs.value.filter((l) => l.isNew && !l.deleted)
    const deleteOps = logs.value.filter((l) => l.deleted && !l.isNew)

    // Sort createOps by initial insertion order (id timestamp) for deterministic offsets
    createOps.sort((a,b)=>a.id.localeCompare(b.id))

    // All work-logs for the day should share the same start time (09:00).
    const startedStr = dayjs(props.date)
      .tz('Asia/Bangkok')
      .hour(9)
      .minute(0)
      .second(0)
      .millisecond(0)
      .format('YYYY-MM-DDTHH:mm:ss.SSSZZ')

    // Run creation and deletion operations in parallel to speed up saves
    const createPromises = createOps.map(async (l) => {
      const resp = await createWorklog(
        l.issueKey,
        l.timeSpentSeconds / 3600,
        startedStr
      )
      // Replace temporary id with the real one and mark as persisted
      if (resp && resp.id) l.id = resp.id
      l.isNew = false
    })

    const deletePromises = deleteOps.map((l) =>
      jiraFetch(
        `rest/api/3/issue/${l.issueKey}/worklog/${l.id}?notifyUsers=false`,
        {
          method: 'DELETE',
        }
      )
    )

    await Promise.all([...createPromises, ...deletePromises])

    // Prune deleted items and persist the fresh list into the global store
    logs.value = logs.value.filter((l) => !l.deleted)
    logs.value.forEach((l) => {
      // Ensure no lingering flags
      l.isNew = false
      delete l.deleted
    })

    setLogs(
      props.date,
      logs.value.map((l) => ({
        id: l.id,
        issueKey: l.issueKey,
        summary: l.summary,
        timeSpentSeconds: l.timeSpentSeconds,
      }))
    )

    await fetchLogs()
    unsaved.value = false
    // Auto-close modal after successful save
    attemptClose()
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function attemptClose() {
  if (unsaved.value) {
    if (!confirm('You have unsaved changes. Discard them?')) {
      return
    }
  }
  emit('close')
}

function isWeekendDay(dateObj) {
  const d = dayjs(dateObj).day()
  return d === 0 || d === 6
}

function currentTotalHours() {
  return displayedLogs.value.reduce((s, l) => s + (l.timeSpentSeconds ?? 0) / 3600, 0)
}

function resetModalState() {
  issueInput.value = '';
  duration.value = 1;
  manualError.value = '';
  searchedIssue.value = null;
  suggestions.value = [];
  skipNextLookup.value = false;
  unsaved.value = false;
  pageStart.value = 0;
  activeIssues.value = [];
  logs.value = [];
}

// When user clicks common preset, fill manual fields but do not add log yet
function onCommonPreset(preset) {
  manualError.value = ''
  issueInput.value = preset.issueKey
  duration.value = preset.defaultHours ?? 1

  // Prefill summary if fetched
  const summary = presetSummaries[preset.issueKey] || preset.label
  searchedIssue.value = { key: preset.issueKey, summary }

  skipNextLookup.value = true
  suggestions.value = []
}

async function fillMissingSummaries() {
  // Fetch summaries for logs that currently lack a summary so the modal table shows meaningful information
  const keysToFetch = [...new Set(logs.value.filter(l => !l.summary || l.summary === '').map(l => l.issueKey))]
  if (keysToFetch.length === 0) return

  await Promise.all(
    keysToFetch.map(async (k) => {
      try {
        // Re-use cached preset summaries first to minimise network calls
        let summary = presetSummaries[k]
        if (!summary) {
          const data = await jiraFetch(`rest/api/3/issue/${k}?fields=summary`)
          summary = data?.fields?.summary ?? ''
        }
        if (summary) {
          logs.value.forEach(l => {
            if (l.issueKey === k && (!l.summary || l.summary === '')) {
              l.summary = summary
            }
          })
        }
      } catch {
        /* ignore fetch errors – leave summary blank if retrieval fails */
      }
    })
  )
}
</script>
