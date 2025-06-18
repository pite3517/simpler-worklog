<template>
  <dialog ref="dlg" class="modal" @click.self="attemptClose">
    <div class="modal-box w-full max-w-3xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">{{ formattedDate }}</h3>
        <span class="text-xl font-semibold">
          {{ totalHours.toFixed(2) }}h
          <span class="text-sm opacity-70"> ({{ remainingHours().toFixed(2) }}h remaining)</span>
        </span>
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
                <td class="!align-middle">
                  <div class="flex items-center gap-2">
                    <img v-if="log.issueType" :src="issueTypeIcon(log.issueType)" class="w-4 h-4" >
                    <a
                      :href="`https://linemanwongnai.atlassian.net/browse/${log.issueKey}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="no-underline hover:underline"
                    >
                      {{ log.issueKey }}
                    </a>
                  </div>
                </td>
                <td class="align-middle">
                  <a
                    :href="`https://linemanwongnai.atlassian.net/browse/${log.issueKey}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="no-underline hover:underline"
                  >
                    {{ log.summary }}
                  </a>
                </td>
                <td :class="['text-right', 'align-middle', log.reduced ? 'text-warning' : '']">
                  {{ ((log.timeSpentSeconds ?? 0) / 3600).toFixed(2) }}
                </td>
                <td class="w-14 text-right">
                  <button class="btn btn-xs btn-ghost" @click="onDelete(log)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" />
                    </svg>
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
        <h4 class="font-semibold text-sm mt-4">Commons</h4>
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
        <ul
          ref="issuesList"
          class="border rounded max-h-50 overflow-y-auto mb-2 text-sm"
        >
          <li
            v-for="iss in activeIssues"
            :key="iss.key"
            class="px-2 py-1 cursor-pointer hover:bg-base-200 flex gap-2 items-center"
            @click="onIssueSelect(iss)"
          >
            <img v-if="iss.issueType" :src="issueTypeIcon(iss.issueType)" class="w-4 h-4" >
            <span class="font-mono font-semibold">{{ iss.key }}</span>
            <span class="truncate">{{ iss.summary }}</span>
          </li>
          <!-- No active issues fallback -->
          <li
            v-if="activeIssues.length === 0 && pageStart >= issuesTotal && !loadingMore"
            class="p-2 text-center text-sm opacity-60"
          >
            No active issues found.
          </li>
          <!-- Sentinel row for IntersectionObserver. Shows spinner while loading -->
          <li
            v-if="pageStart < issuesTotal"
            ref="loadMoreTrigger"
            class="px-2 py-1 text-center"
          >
            <span
              v-if="loadingMore"
              class="loading loading-spinner text-primary"
            />
          </li>
        </ul>
      </div>

      <!-- Manual Add -->
      <div class="mt-4">
        <h4 class="font-semibold text-sm mb-2">Manual Add</h4>
        <div class="flex items-center gap-2 flex-wrap">
          <input
            ref="manualInput"
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
            <span
              :class="['font-mono', 'text-md', 'w-14', 'text-center', 'font-semibold', durationReduced ? 'text-warning' : 'text-primary']"
              >{{ duration.toFixed(2) }}h</span
            >
            <button class="btn btn-xs" @click="bump(0.5)">+30m</button>
            <button class="btn btn-xs" @click="bump(1)">+1h</button>
            <button class="btn btn-xs" @click="bump(5)">+5h</button>
          </div>
          <button class="btn btn-sm btn-primary" @click="addManual">Add</button>
        </div>
        <p v-if="manualError" class="text-error text-sm mt-2">
          {{ manualError }}
        </p>
        <p
          class="text-sm mt-2 truncate h-5"
          :style="{ visibility: searchedIssue && !manualError ? 'visible' : 'hidden' }"
        >
          <span v-if="searchedIssue" class="flex items-center gap-1">
            <img v-if="searchedIssue.issueType" :src="issueTypeIcon(searchedIssue.issueType)" class="w-4 h-4 mr-1" >
            <a
              :href="`https://linemanwongnai.atlassian.net/browse/${searchedIssue.key}`"
              target="_blank"
              rel="noopener noreferrer"
              class="no-underline hover:underline"
            >
              {{ searchedIssue.summary }}
            </a>
          </span>
        </p>
        <ul
          v-if="suggestions.length"
          class="border rounded mt-2 max-h-48 overflow-y-auto text-sm"
        >
          <li
            v-for="s in suggestions"
            :key="s.key"
            class="px-2 py-1 cursor-pointer hover:bg-base-200 flex gap-2 items-center"
            @click="onSuggestion(s)"
          >
            <img v-if="s.issueType" :src="issueTypeIcon(s.issueType)" class="w-4 h-4" >
            <span class="font-mono font-semibold">{{ s.key }}</span>
            <span class="truncate">{{ s.summary }}</span>
          </li>
          <!-- Sentinel row for IntersectionObserver. Shows spinner while loading -->
          <li
            v-if="suggestionPageStart < suggestionTotal"
            ref="suggestionsLoadMoreTrigger"
            class="px-2 py-1 text-center"
          >
            <span
              v-if="suggestionLoadingMore"
              class="loading loading-spinner text-primary"
            />
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
import { ref, watch, onMounted, computed, toRefs, onBeforeUnmount, reactive, nextTick } from "vue";
import { jiraFetch } from "~/composables/useJiraApi";
import { useWorklogStore } from "~/composables/useWorklogStore";
import { useToastStore } from "~/composables/useToastStore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import weekOfYear from "dayjs/plugin/weekOfYear";
import debounce from "lodash.debounce";
import { useFocus } from "@vueuse/core";
import { onBeforeRouteLeave } from "vue-router";
import { useSavingIndicator } from "~/composables/useSavingIndicator";

// Initialise Day.js with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekOfYear);

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
const { saving } = useSavingIndicator();

// Active issues pagination state
const activeIssues = ref([]);
const issuesTotal = ref(0);
const pageStart = ref(0);
const pageSize = 10;

// Infinite-scroll state
const loadingMore = ref(false);
const loadMoreTrigger = ref(null);
let loadObserver = null;

// Manual issue search state
const searchedIssue = ref(null);
const searchLoading = ref(false);
const suggestions = ref([]);
const skipNextLookup = ref(false);

// Suggestions pagination state (for infinite scroll within search results)
const suggestionPageStart = ref(0);
const suggestionPageSize = 10;
const suggestionTotal = ref(0);
const suggestionLoadingMore = ref(false);
const suggestionsLoadMoreTrigger = ref(null);
let suggestionsObserver = null;
const currentSuggestionTerm = ref('');

// Map of issueKey -> summary and issueType cached for presets
const presetSummaries = reactive({});
const presetIssueTypes = reactive({});

// Central work-log cache
const { getLogs, fetchMonth, setLogs, markUpdated, getHours } = useWorklogStore();
const { addToast } = useToastStore();

// Autofocus handling for Manual Add input
const manualInput = ref(null);
const { focused: manualFocused } = useFocus(manualInput);

const issueSlugMap = {
  Bug: 'bug',
  'Production Bug': 'production-bug',
  Task: 'task',
  'Sub-task': 'sub-task',
  Story: 'story',
  Epic: 'epic',
};

function issueTypeIcon(name) {
  if (!name) return '';
  const slug = issueSlugMap[name] ?? name.toLowerCase().replace(/\s+/g, '-');
  return `/img/issue-type/${slug}.png`;
}

function focusManual() {
  // Run after next tick & microtasks to avoid DaisyUI modal stealing focus
  nextTick(() => {
    setTimeout(() => {
      manualFocused.value = true;
      manualInput.value?.focus({ preventScroll: true });
    }, 20); // slight delay to ensure dialog internal focus finishes
  });
}

// Debounced lookup function using lodash.debounce (300 ms)
const debouncedLookup = debounce(async (term) => {
  searchLoading.value = true;
  suggestions.value = [];
  try {
    const keyMatch = parseIssueKey(term);
    if (keyMatch && keyMatch === term.toUpperCase()) {
      // Exact key pattern – try direct fetch
      const data = await jiraFetch(`rest/api/3/issue/${keyMatch}?fields=summary,issuetype`);
      searchedIssue.value = { key: data.key, summary: data.fields.summary, issueType: data.fields.issuetype?.name };
      manualError.value = "";
    } else {
      // Generic search for suggestions with pagination (first page)
      currentSuggestionTerm.value = term;
      suggestionPageStart.value = 0;
      suggestionTotal.value = 0;
      const body = {
        jql: `summary ~ "${term}*" AND issuetype in (Epic, Task, Story, Bug, "Production Bug", "Sub-task", Subtask) ORDER BY updated DESC`,
        fields: ["summary", "issuetype"],
        maxResults: suggestionPageSize,
        startAt: suggestionPageStart.value,
      };
      const res = await jiraFetch("rest/api/3/search", {
        method: "POST",
        body: JSON.stringify(body),
      });
      suggestions.value =
        res.issues?.map((i) => ({ key: i.key, summary: i.fields.summary, issueType: i.fields.issuetype?.name })) ?? [];
      suggestionTotal.value = res.total ?? suggestions.value.length;
      suggestionPageStart.value += suggestions.value.length;
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

// Human-readable header: "Mon, 10 Jun (1st Wk/2nd Wk)" based on week parity
const formattedDate = computed(() => {
  if (!props.date) return "";
  const d = dayjs(props.date);
  const weekNo = d.week();
  const weekLabel = weekNo % 2 === 1 ? "2nd Week" : "1st Week";
  return `${d.format("ddd, DD MMM")} (${weekLabel})`;
});

const displayedLogs = computed(() => logs.value.filter(l => !l.deleted));

const totalHours = computed(() => currentTotalHours());

watch(
  () => props.visible,
  async (v) => {
    if (!dlg.value) return;
    if (v && props.date) {
      if (!dlg.value.open) dlg.value.showModal();

      // Focus ASAP once dialog is open
      focusManual();

      // Load logs, then re-apply focus (network latency may have shifted focus)
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

  // Observe sentinel rows for infinite scroll in both Active Issues and Suggestions lists
  watch(
    () => loadMoreTrigger.value,
    (el) => {
      if (loadObserver) loadObserver.disconnect();
      if (!el) return;
      loadObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadMore();
          }
        },
        { root: null, threshold: 1 }
      );
      loadObserver.observe(el);
    },
    { immediate: true }
  );

  // Suggestions observer
  watch(
    () => suggestionsLoadMoreTrigger.value,
    (el) => {
      if (suggestionsObserver) suggestionsObserver.disconnect();
      if (!el) return;
      suggestionsObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadMoreSuggestions();
          }
        },
        { root: null, threshold: 1 }
      );
      suggestionsObserver.observe(el);
    },
    { immediate: true }
  );
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
  { label: "Grooming",         hours: 1, issueKey: "ADM-19" },
  { label: "Knowledge Sharing", hours: 1, issueKey: "ADM-20" },
  { label: "Planning",         hours: 1, issueKey: "ADM-16" },
  { label: "Retrospective",    hours: 1, issueKey: "ADM-18" },

];

// Common presets that pre-fill manual section (no immediate add)
const commonPresets = [
  { label: 'Holiday', issueKey: 'ADM-1', defaultHours: 8 },
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
          const data = await jiraFetch(`rest/api/3/issue/${p.issueKey}?fields=summary,issuetype`);
          presetSummaries[p.issueKey] = data.fields.summary;
          presetIssueTypes[p.issueKey] = data.fields.issuetype?.name;
        } catch {
          /* ignore fetch errors */
        }
      })
  );
}

async function loadActiveIssues(append = false) {
  try {
    if (append) loadingMore.value = true;
    const body = {
      jql: `assignee = currentUser() AND updated >= -30d AND issuetype in (Epic, Task, Story, Bug, "Production Bug", "Sub-task", Subtask) ORDER BY updated DESC`,
      fields: ["summary", "issuetype"],
      maxResults: pageSize,
      startAt: pageStart.value,
    };
    const data = await jiraFetch("rest/api/3/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const newItems =
      data.issues?.map((i) => ({ key: i.key, summary: i.fields.summary, issueType: i.fields.issuetype?.name })) ??
      [];

    if (append) {
      activeIssues.value.push(...newItems);
    } else {
      activeIssues.value = newItems;
    }

    issuesTotal.value = data.total ?? activeIssues.value.length;
    pageStart.value += newItems.length;
  } catch (err) {
    console.error(err);
  } finally {
    loadingMore.value = false;
  }
}

// Triggered by IntersectionObserver when sentinel enters the viewport
async function loadMore() {
  if (loadingMore.value) return;
  if (pageStart.value >= issuesTotal.value) return;
  await loadActiveIssues(true);
}

// Reload active issues list each time the modal opens
watch(
  () => props.visible,
  (v) => {
    if (v) {
      pageStart.value = 0;
      activeIssues.value = [];
      issuesTotal.value = 0;
      loadActiveIssues();
    }
  }
);

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
  const isReduced = hoursToAdd < preset.hours;
  const summary = preset.issueKey ? (presetSummaries[preset.issueKey] || preset.label) : preset.label;

  logs.value.push({
    id: 'tmp-' + Date.now(),
    issueKey: preset.issueKey,
    summary,
    timeSpentSeconds: parseFloat(hoursToAdd.toFixed(2)) * 3600,
    isNew: true,
    issueType: presetIssueTypes[preset.issueKey],
    reduced: isReduced,
  })
  unsaved.value = true;

  // Ensure newly added preset log also gets issueType if not yet cached
  if (!presetIssueTypes[preset.issueKey]) {
    fillMissingSummaries();
  }
}

function onIssueSelect(issue) {
  manualError.value = '';
  issueInput.value = issue.key;
  searchedIssue.value = { key: issue.key, summary: issue.summary, issueType: issue.issueType };
  skipNextLookup.value = true;
  // Reset duration to 1h as default, user can adjust via chips
  duration.value = 1;
  adjustDurationToLimit();
  // Clear suggestions to avoid confusion
  suggestions.value = [];
  // Focus could be handled by ref but omitted here for brevity
}

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
  searchedIssue.value = { key: issue.key, summary: issue.summary, issueType: issue.issueType };
  skipNextLookup.value = true;
  adjustDurationToLimit();
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

  // If bump resulted in capping to remaining hours, mark as reduced
  durationReduced.value = duration.value < nextRaw;
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
  if (loadObserver) loadObserver.disconnect();
  if (suggestionsObserver) suggestionsObserver.disconnect();
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
    issueType: searchedIssue.value.issueType,
  })

  // Reset input & duration UI
  issueInput.value = ''
  duration.value = 1
  durationReduced.value = false

  unsaved.value = true;
}

// ------------------- Save / Close handling -----------------------------------

function handleBeforeUnload(e) {
  if (!saving.value) return;
  e.preventDefault();
  e.returnValue = '';
}

watch(saving, (v) => {
  if (typeof window === 'undefined') return;
  if (v) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  } else {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }
});

// Guard in-app route navigation while the save request is still pending
onBeforeRouteLeave(() => {
  if (saving.value) {
    const ok = window.confirm('Worklog save is still in progress. Leave anyway?');
    if (!ok) return false; // cancel navigation
  }
});

function saveChanges() {
  if (saving.value) return; // prevent duplicate clicks

  // ---------------- Business rules validation -----------------------------
  if (isWeekendDay(props.date)) {
    alert('Cannot log work on weekend');
    return;
  }

  const total = currentTotalHours();
  if (total > 8) {
    alert('Total hours exceed 8h limit');
    return;
  }
  if (total < 8) {
    if (!confirm('Total hours < 8h. Proceed anyway?')) {
      return;
    }
  }

  // Mark states BEFORE kicking off async save so UI can close immediately
  saving.value = true;
  loading.value = true; // still useful for other visual cues (e.g. global spinner)
  unsaved.value = false;

  // Capture a stable reference to the current logs array BEFORE the modal state may reset
  const logsSnapshot = logs.value;
  // Snapshot the current date so async save logic isn't affected if the modal is later reused for another day
  const saveDate = props.date;

  // Fire-and-forget async save operation using the snapshot to avoid it being cleared by resetModalState
  ;(async () => {
    try {
      const createOps = logsSnapshot.filter((l) => l.isNew && !l.deleted);
      const deleteOps = logsSnapshot.filter((l) => l.deleted && !l.isNew);

      // Deterministic insertion order
      createOps.sort((a, b) => a.id.localeCompare(b.id));

      const startedStr = dayjs(saveDate)
        .tz('Asia/Bangkok')
        .hour(9)
        .minute(0)
        .second(0)
        .millisecond(0)
        .format('YYYY-MM-DDTHH:mm:ss.SSSZZ');

      const createPromises = createOps.map(async (l) => {
        const resp = await createWorklog(
          l.issueKey,
          l.timeSpentSeconds / 3600,
          startedStr
        );
        if (resp && resp.id) l.id = resp.id;
        l.isNew = false;
      });

      const deletePromises = deleteOps.map((l) =>
        jiraFetch(
          `rest/api/3/issue/${l.issueKey}/worklog/${l.id}?notifyUsers=false`,
          { method: 'DELETE' }
        )
      );

      await Promise.all([...createPromises, ...deletePromises]);

      // Remove any entries flagged for deletion from the snapshot
      const finalLogs = logsSnapshot.filter((l) => !l.deleted);
      finalLogs.forEach((l) => {
        l.isNew = false;
        delete l.deleted;
      });

      // Capture hours prior to updating the store so highlight uses previous colour
      const prevHours = getHours(saveDate);

      // Persist the cleaned list into the global store (calendar cache)
      setLogs(
        saveDate,
        finalLogs.map((l) => ({
          id: l.id,
          issueKey: l.issueKey,
          summary: l.summary,
          timeSpentSeconds: l.timeSpentSeconds,
          issueType: l.issueType,
        }))
      );

      markUpdated(saveDate, prevHours, total);

      // Refresh the local modal cache only if the modal is still showing the same date
      if (props.date === saveDate) {
        await fetchLogs();
      }
      addToast(`Worklogs saved for ${formattedDate.value}`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to save worklogs. See console for details.', 'error');
    } finally {
      loading.value = false;
      saving.value = false;
    }
  })();

  // Close the dialog right away; navigation guard will protect while saving
  attemptClose();
}

function attemptClose() {
  // If a save is in progress we allow immediate close without warning
  if (!saving.value && unsaved.value) {
    if (!confirm('You have unsaved changes. Discard them?')) {
      return;
    }
  }
  emit('close');
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

  // Reset infinite scroll state to avoid duplicate observers after reopen
  pageStart.value = 0;
  activeIssues.value = [];
  issuesTotal.value = 0;
  loadingMore.value = false;

  if (loadObserver) {
    loadObserver.disconnect();
    loadObserver = null;
  }

  loadMoreTrigger.value = null; // ensure new observer will be attached fresh

  logs.value = [];

  // Reset suggestions pagination / observer state
  suggestionPageStart.value = 0;
  suggestionTotal.value = 0;
  suggestionLoadingMore.value = false;
  currentSuggestionTerm.value = '';
  if (suggestionsObserver) {
    suggestionsObserver.disconnect();
    suggestionsObserver = null;
  }
  suggestionsLoadMoreTrigger.value = null;
}

// When user clicks common preset, fill manual fields but do not add log yet
function onCommonPreset(preset) {
  manualError.value = ''
  issueInput.value = preset.issueKey
  duration.value = preset.defaultHours ?? 1

  adjustDurationToLimit();

  // Prefill summary if fetched
  const summary = presetSummaries[preset.issueKey] || preset.label
  const issueType = presetIssueTypes[preset.issueKey]
  searchedIssue.value = { key: preset.issueKey, summary, issueType }

  skipNextLookup.value = true
  suggestions.value = []
}

async function fillMissingSummaries() {
  // Fetch summaries/issue types for logs lacking them so UI has complete info
  const keysToFetch = [...new Set(logs.value.filter(l => (!l.summary || l.summary === '') || !l.issueType).map(l => l.issueKey))]
  if (keysToFetch.length === 0) return

  await Promise.all(
    keysToFetch.map(async (k) => {
      try {
        // Re-use cached preset summaries first to minimise network calls
        let cachedSummary = presetSummaries[k]
        let fetchedSummary = cachedSummary
        let fetchedType

        if (!cachedSummary || logs.value.some(l => l.issueKey === k && !l.issueType)) {
          const data = await jiraFetch(`rest/api/3/issue/${k}?fields=summary,issuetype`)
          fetchedSummary = data?.fields?.summary ?? cachedSummary ?? ''
          fetchedType = data?.fields?.issuetype?.name
        }

        logs.value.forEach(l => {
          if (l.issueKey === k) {
            if (!l.summary || l.summary === '') l.summary = fetchedSummary
            if (!l.issueType && fetchedType) l.issueType = fetchedType
          }
        })
      } catch {
        /* ignore fetch errors – leave attributes blank if retrieval fails */
      }
    })
  )
}

async function loadMoreSuggestions() {
  if (suggestionLoadingMore.value) return;
  if (suggestionPageStart.value >= suggestionTotal.value) return;
  suggestionLoadingMore.value = true;
  try {
    const body = {
      jql: `summary ~ "${currentSuggestionTerm.value}*" AND issuetype in (Epic, Task, Story, Bug, "Production Bug", "Sub-task", Subtask) ORDER BY updated DESC`,
      fields: ["summary", "issuetype"],
      maxResults: suggestionPageSize,
      startAt: suggestionPageStart.value,
    };
    const res = await jiraFetch("rest/api/3/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const newItems =
      res.issues?.map((i) => ({ key: i.key, summary: i.fields.summary, issueType: i.fields.issuetype?.name })) ?? [];
    suggestions.value.push(...newItems);

    suggestionPageStart.value += newItems.length;
    suggestionTotal.value = res.total ?? suggestionTotal.value;
  } catch (err) {
    console.error(err);
  } finally {
    suggestionLoadingMore.value = false;
  }
}

const durationReduced = ref(false);

function adjustDurationToLimit() {
  const remain = remainingHours();
  if (duration.value > remain) {
    // Cap duration to remaining hours and mark as reduced
    duration.value = parseFloat(remain.toFixed(2));
    durationReduced.value = true;
  } else {
    durationReduced.value = false;
  }
}
</script>
