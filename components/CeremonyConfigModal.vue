<template>
  <Teleport to="body">
    <div v-if="visible" class="modal modal-open" @click.self="$emit('close')">
      <div class="modal-box w-11/12 max-w-5xl relative">
        <h3 class="font-bold text-lg">Configure Ceremony Mappings</h3>
        <p class="py-2 text-sm">
          <span v-if="eventData.length > 0" class="text-blue-600 font-medium">
            🗕️ Auto-filled from calendar:
          </span>
          Map calendar event titles to JIRA issues for automatic work logging.
          <span v-if="eventData.length > 0" class="text-blue-600">
            Select a team preset to auto-match issue keys.
          </span>
          Click "Save" to apply your changes.
        </p>

        <!-- Team preset selector -->
        <div class="form-control w-48 mb-2">
          <label class="label" for="teamPreset">
            <span
              class="label-text"
              :class="{ 'text-blue-600 font-medium': eventData.length > 0 }"
            >
              Team preset
            </span>
          </label>
          <select
            id="teamPreset"
            class="select select-sm select-bordered"
            :class="{ 'border-blue-400': eventData.length > 0 }"
            @change="onPresetChange($event)"
          >
            <option value="">-- Select preset --</option>
            <option value="sally">Sally</option>
            <option value="pangyo">Pangyo</option>
          </select>
        </div>

        <!-- Show event data table if we have calendar events -->
        <div v-if="eventData.length > 0" class="mb-6">
          <h4 class="font-semibold mb-2">Calendar Events to Map</h4>
          <div class="overflow-x-auto overflow-y-visible">
            <table class="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Event Title</th>
                  <th>JIRA Issue</th>
                  <th>Dates</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(event, index) in eventData" :key="index">
                  <td class="font-medium">{{ event.title }}</td>
                  <td class="relative">
                    <input
                      v-model="event.issueKey"
                      type="text"
                      class="input input-bordered input-sm w-full"
                      placeholder="e.g. ADM-10"
                      @input="onIssueInput(event, $event)"
                      @focus="onIssueFocus()"
                      @blur="onIssueBlur(event)"
                      @keyup.enter="validateIssueKey(event)"
                    >

                    <!-- Issue summary display -->
                    <div
                      v-if="event.issueSummary"
                      class="text-xs text-gray-600 mt-1 flex items-center gap-1"
                    >
                      <img
                        v-if="event.issueType"
                        :src="issueTypeIcon(event.issueType)"
                        class="w-3 h-3"
                      >
                      <span class="truncate">{{ event.issueSummary }}</span>
                    </div>

                    <!-- Error display -->
                    <div
                      v-if="event.issueError"
                      class="text-xs text-error mt-1"
                    >
                      {{ event.issueError }}
                    </div>

                    <!-- Search suggestions dropdown -->
                    <ul
                      v-if="event.suggestions && event.suggestions.length > 0"
                      class="absolute z-50 w-full border bg-base border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto"
                    >
                      <li
                        v-for="suggestion in event.suggestions"
                        :key="suggestion.key"
                        class="px-3 py-2 cursor-pointer hover:bg-primary/10 flex gap-2 items-center text-sm"
                        @click="selectSuggestion(event, suggestion)"
                      >
                        <img
                          v-if="suggestion.issueType"
                          :src="issueTypeIcon(suggestion.issueType)"
                          class="w-4 h-4"
                        >
                        <span class="font-mono font-semibold">{{
                          suggestion.key
                        }}</span>
                        <span class="truncate">{{ suggestion.summary }}</span>
                      </li>
                    </ul>

                    <!-- Loading indicator -->
                    <div
                      v-if="event.searching"
                      class="absolute right-2 top-1/2 transform -translate-y-1/2"
                    >
                      <span class="loading loading-spinner loading-xs" />
                    </div>
                  </td>
                  <td class="text-sm text-gray-600">
                    <div
                      v-for="(dateEntry, idx) in event.dates"
                      :key="idx"
                      class="mb-1"
                    >
                      {{ new Date(dateEntry.date).toLocaleDateString() }}
                    </div>
                  </td>
                  <td class="text-sm text-gray-600">
                    <div
                      v-for="(dateEntry, idx) in event.dates"
                      :key="idx"
                      class="mb-1"
                    >
                      {{ dateEntry.hours }}h
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-primary" @click="saveConfigs">
            <span v-if="eventData.length > 0"> Save & Fill Calendar </span>
            <span v-else> Save </span>
          </button>
          <button class="btn" @click="$emit('close')">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useCeremonyConfig } from "~/composables/useCeremonyConfig";
import { useToastStore } from "~/composables/useToastStore";
import { jiraFetch } from "~/composables/useJiraApi";
import { debounce } from "lodash-es";
// Import preset CSVs as raw text so we can parse them on demand
// Using Vite raw plugin syntax – supported by Nuxt 3.
// Ensure the files exist in project root (or move to assets if needed)
import sallyMappings from "~/presets/sally-mappings.json";
import pangyoMappings from "~/presets/pangyo-mappings.json";

defineProps({
  visible: Boolean,
});
const emit = defineEmits(["close", "saved"]);

const {
  configs,
  eventData,
  // addConfig,
  saveConfigs: saveConfigsToStore,
  setConfigs,
  // setEventData,
} = useCeremonyConfig();
const { addToast } = useToastStore();

// Map preset key -> mapping array
const presetMap = {
  sally: sallyMappings,
  pangyo: pangyoMappings,
};

function loadPreset(key) {
  const mappings = presetMap[key];
  if (!mappings) {
    addToast(`Preset "${key}" not found`, "error");
    return;
  }

  // If we have event data (auto-filled from calendar), try to match with preset
  if (eventData.value.length > 0) {
    let matchedCount = 0;

    eventData.value.forEach((event) => {
      // Check if any preset mapping title matches this event title
      const matchingPreset = mappings.find(
        (presetMapping) =>
          event.title
            .toLowerCase()
            .includes(presetMapping.title.toLowerCase()) ||
          presetMapping.title.toLowerCase().includes(event.title.toLowerCase())
      );

      if (matchingPreset) {
        event.issueKey = matchingPreset.issueKey;
        matchedCount++;
      } else {
        event.issueKey = null;
      }
    });

    addToast(
      `Applied ${key} preset: ${matchedCount} event types matched with issue keys`,
      "success"
    );
  } else {
    // Replace existing configs with preset mappings
    setConfigs(mappings);
    addToast(
      `Loaded ${mappings.length} mappings from ${key} preset`,
      "success"
    );
  }
}

function onPresetChange(event) {
  const selectedPreset = event.target.value;
  if (selectedPreset) {
    loadPreset(selectedPreset);
  }
}

// Issue type icon mapping (copied from WorklogModal)
const issueSlugMap = {
  Bug: "bug",
  "Production Bug": "production-bug",
  Task: "task",
  "Sub-task": "sub-task",
  Story: "story",
  Epic: "epic",
};

function issueTypeIcon(name) {
  if (!name) return "";
  const slug = issueSlugMap[name] ?? name.toLowerCase().replace(/\s+/g, "-");
  return `/img/issue-type/${slug}.png`;
}

function parseIssueKey(input) {
  // Accept plain key (ABC-123) or any Jira URL containing the key
  const KEY_RE = /([A-Z][A-Z0-9]+-\d+)/;
  const m = input.toUpperCase().match(KEY_RE);
  return m ? m[1] : null;
}

// JIRA search functionality
const debouncedSearch = debounce(async (event, term) => {
  if (!term || term.length < 2) {
    event.suggestions = [];
    return;
  }

  event.searching = true;
  try {
    const keyMatch = parseIssueKey(term);
    if (keyMatch && keyMatch === term.toUpperCase()) {
      // Exact key pattern – try direct fetch
      const data = await jiraFetch(
        `rest/api/3/issue/${keyMatch}?fields=summary,issuetype`
      );
      event.suggestions = [
        {
          key: data.key,
          summary: data.fields.summary,
          issueType: data.fields.issuetype?.name,
        },
      ];
    } else {
      // Generic search for suggestions
      const body = {
        jql: `summary ~ "${term}*" AND issuetype in (Epic, Task, Story, Bug, "Production Bug", "Sub-task", Subtask) ORDER BY updated DESC`,
        fields: ["summary", "issuetype"],
        maxResults: 10,
      };
      const res = await jiraFetch("rest/api/3/search/jql", {
        method: "POST",
        body: JSON.stringify(body),
      });

      event.suggestions =
        res.issues?.map((i) => ({
          key: i.key,
          summary: i.fields.summary,
          issueType: i.fields.issuetype?.name,
        })) ?? [];
    }
  } catch (error) {
    console.error("Error searching JIRA issues:", error);
    event.suggestions = [];
  } finally {
    event.searching = false;
  }
}, 300);

function onIssueInput(event, inputEvent) {
  const term = inputEvent.target.value.trim();

  // Clear previous state
  event.issueError = null;
  event.issueSummary = null;
  event.issueType = null;

  if (term.length >= 2) {
    // Check if it's a valid issue key pattern
    const keyMatch = parseIssueKey(term);
    if (keyMatch && keyMatch === term.toUpperCase()) {
      // Auto-validate if it looks like a complete issue key
      validateIssueKey(event);
    } else {
      // Show suggestions for partial matches
      debouncedSearch(event, term);
    }
  } else {
    event.suggestions = [];
  }
}

function onIssueFocus() {
  // Properties are already initialized as reactive in pages/index.vue
  // This function is kept for potential future focus-related logic
}

function onIssueBlur(event) {
  // Delay hiding suggestions to allow clicking on them
  setTimeout(() => {
    event.suggestions = [];
  }, 200);
}

function selectSuggestion(event, suggestion) {
  event.issueKey = suggestion.key;
  event.issueSummary = suggestion.summary;
  event.issueType = suggestion.issueType;
  event.issueError = null;
  event.suggestions = [];
  addToast(`Selected ${suggestion.key}: ${suggestion.summary}`, "success");
}

async function validateIssueKey(event) {
  const issueKey = event.issueKey?.trim();
  if (!issueKey) return;

  const keyMatch = parseIssueKey(issueKey);
  if (!keyMatch) {
    event.issueError = "Invalid issue key format";
    event.issueSummary = null;
    event.issueType = null;
    return;
  }

  // Set the cleaned up key
  event.issueKey = keyMatch;
  event.searching = true;
  event.issueError = null;

  try {
    const data = await jiraFetch(
      `rest/api/3/issue/${keyMatch}?fields=summary,issuetype`
    );
    event.issueSummary = data.fields.summary;
    event.issueType = data.fields.issuetype?.name;
    event.suggestions = []; // Clear suggestions
    addToast(`Validated ${keyMatch}: ${data.fields.summary}`, "success");
  } catch (error) {
    console.error("Error validating issue:", error);
    event.issueError = "Issue not found or access denied";
    event.issueSummary = null;
    event.issueType = null;
  } finally {
    event.searching = false;
  }
}

function saveConfigs() {
  // Save any event data mappings to persistent configs for future auto-matching
  if (eventData.value.length > 0) {
    const updatedConfigs = [...configs.value];

    eventData.value.forEach((event) => {
      if (event.issueKey) {
        // Check if this title pattern already exists in configs
        const existingConfigIndex = updatedConfigs.findIndex(
          (config) =>
            config.title.toLowerCase() === event.title.toLowerCase() ||
            config.title.toLowerCase().includes(event.title.toLowerCase()) ||
            event.title.toLowerCase().includes(config.title.toLowerCase())
        );

        if (existingConfigIndex >= 0) {
          // Update existing config
          updatedConfigs[existingConfigIndex].issueKey = event.issueKey;
        } else {
          // Add new config
          updatedConfigs.push({
            title: event.title,
            issueKey: event.issueKey,
          });
        }
      }
    });

    // Update the configs
    setConfigs(updatedConfigs);
  }

  saveConfigsToStore();
  addToast("Configuration saved!", "success");
  emit("saved");
  emit("close");
}
</script>
