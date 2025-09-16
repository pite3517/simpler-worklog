<template>
  <dialog ref="dlg" class="modal" @click.self="closeModal">
    <div class="modal-box w-11/12 max-w-6xl relative">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-bold text-lg">Configure Ceremony Settings</h3>
          <div v-if="hasUnsavedChanges" class="badge badge-warning badge-sm">
            Unsaved Changes
          </div>
        </div>
        <p class="py-2 text-sm text-gray-600">
          Configure ceremony names, issue keys, and default durations. These will be used when you click the ceremony preset buttons.
        </p>

        <div class="overflow-x-auto mt-4">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Ceremony Name</th>
                <th>Issue Key</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <ClientOnly>
              <tbody>
                <tr v-for="(ceremony, index) in localDurations" :key="index">
                <td class="w-1/3">
                  <input
                    :value="ceremony.label"
                    type="text"
                    placeholder="Ceremony name"
                    class="input input-sm input-bordered w-full"
                    @input="updateCeremonyField(index, 'label', $event.target.value)"
                  >
                </td>
                <td class="w-1/3 relative">
                  <div class="relative">
                    <input
                      :value="ceremony.issueKey"
                      type="text"
                      placeholder="LM-xxxxx"
                      class="input input-sm input-bordered w-full pr-6"
                      @input="updateIssueKey(index, $event.target.value)"
                      @focus="onIssueKeyFocus(index)"
                    >
                    <button
                      v-if="loadingIssues[index]"
                      class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs p-0 w-4 h-4 min-h-4"
                      disabled
                    >
                      <span class="loading loading-spinner w-3 h-3" />
                    </button>
                    <button
                      v-else-if="validIssues[index] && ceremony.issueKey"
                      class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs p-0 w-4 h-4 min-h-4 text-success"
                      disabled
                    >
                      ✓
                    </button>
                    <button
                      v-else-if="!validIssues[index] && ceremony.issueKey && !loadingIssues[index]"
                      class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs p-0 w-4 h-4 min-h-4 text-error"
                      disabled
                    >
                      ✗
                    </button>
                  </div>
                  <!-- Issue suggestions dropdown -->
                  <ul
                    v-if="issueSuggestions[index] && issueSuggestions[index].length > 0"
                    class="absolute z-50 border rounded mt-1 max-h-48 overflow-y-auto text-sm bg-base-100 shadow-lg left-0 right-0"
                  >
                    <li
                      v-for="suggestion in issueSuggestions[index]"
                      :key="suggestion.key"
                      class="px-3 py-2 cursor-pointer hover:bg-base-200 flex gap-2 items-center"
                      @click="selectIssueSuggestion(index, suggestion)"
                    >
                      <img
                        v-if="suggestion.issueType"
                        :src="issueTypeIcon(suggestion.issueType)"
                        class="w-4 h-4 flex-shrink-0"
                      >
                      <div class="flex flex-col gap-1 min-w-0 flex-1">
                        <span class="font-mono font-semibold text-sm">{{ suggestion.key }}</span>
                        <span class="truncate text-xs text-gray-600">{{ suggestion.summary }}</span>
                      </div>
                    </li>
                  </ul>
                </td>
                <td class="w-1/4">
                  <div class="flex items-center gap-1 justify-center">
                    <button 
                      class="btn btn-xs btn-ghost"
                      :disabled="getMinutesFromHours(ceremony.hours) <= 15"
                      @click="adjustDuration(index, -15)"
                    >
                      -15m
                    </button>
                    <input
                      :value="formatHoursToTime(ceremony.hours)"
                      type="time"
                      step="900"
                      class="input input-sm input-bordered w-24 text-center"
                      @input="updateDurationFromTime(index, $event.target.value)"
                    >
                    <button 
                      class="btn btn-xs btn-ghost"
                      :disabled="ceremony.hours >= 8"
                      @click="adjustDuration(index, 15)"
                    >
                      +15m
                    </button>
                  </div>
                </td>
                <td class="w-12 text-center">
                  <button 
                    class="btn btn-xs btn-ghost text-error"
                    title="Remove ceremony"
                    @click="removeLocalCeremony(index)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6"
                      />
                    </svg>
                  </button>
                </td>
                </tr>
              </tbody>
              <template #fallback>
                <tbody>
                  <tr>
                    <td colspan="4" class="text-center py-4">
                      <span class="loading loading-spinner text-primary" />
                    </td>
                  </tr>
                </tbody>
              </template>
            </ClientOnly>
          </table>
        </div>

        <div class="mt-4 flex justify-between items-center">
          <div class="flex gap-2">
            <button 
              class="btn btn-sm btn-outline"
              @click="addNewCeremony"
            >
              Add Ceremony
            </button>
            <button 
              class="btn btn-sm btn-outline"
              @click="resetToDefaults"
            >
              Reset to Defaults
            </button>
          </div>
          <div class="text-xs text-gray-500">
            Duration in 15-minute increments
          </div>
        </div>

        <div class="modal-action">
          <button 
            class="btn btn-primary" 
            :disabled="!canSave"
            @click="saveDurations"
          >
            Save
          </button>
          <button class="btn" @click="cancelChanges">Cancel</button>
        </div>
    </div>
  </dialog>
</template>

<script setup>
import { ref, watch, onMounted, toRefs, reactive, onBeforeUnmount, computed } from 'vue';
import { useCeremonyDuration } from '~/composables/useCeremonyDuration';
import { useToastStore } from '~/composables/useToastStore';
import { jiraFetch } from '~/composables/useJiraApi';
import debounce from 'lodash.debounce';

const props = defineProps({
  visible: Boolean,
});

const emit = defineEmits(['close', 'saved']);

const { visible } = toRefs(props);
const dlg = ref(null);

const { ceremonyDurations, setCeremonies, saveDurations: saveStore, hydrateFromLocalStorage } = useCeremonyDuration();
const { addToast } = useToastStore();

// Local copy for editing
const localDurations = ref([...ceremonyDurations.value]);
// Store original state to revert on cancel
const originalDurations = ref([...ceremonyDurations.value]);

// Issue validation and search state
const loadingIssues = reactive({});
const validIssues = reactive({});
const issueSuggestions = reactive({});

// Issue slug map for icons (same as WorklogModal)
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

// Mark all stored issue keys as valid (since they were validated before saving)
function markStoredKeysAsValid() {
  // Clear validation state first
  Object.keys(loadingIssues).forEach(key => delete loadingIssues[key]);
  Object.keys(validIssues).forEach(key => delete validIssues[key]);
  Object.keys(issueSuggestions).forEach(key => delete issueSuggestions[key]);
  
  // Mark all stored complete issue keys as valid
  localDurations.value.forEach((ceremony, index) => {
    if (ceremony.issueKey && ceremony.issueKey.trim() && isCompleteIssueKey(ceremony.issueKey)) {
      validIssues[index] = true;
    }
  });
}

// Watch for changes to the store and sync local copy
watch(() => ceremonyDurations.value, (newDurations) => {
  localDurations.value = [...newDurations];
  originalDurations.value = [...newDurations]; // Update original state
  // Mark all stored issue keys as valid (no API calls needed)
  markStoredKeysAsValid();
}, { deep: true, immediate: true });

// Check if term looks like a complete issue key (e.g., "ADM-123" vs "ADM-" or "ADM")
function isCompleteIssueKey(term) {
  const COMPLETE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;
  return COMPLETE_KEY_RE.test(term.toUpperCase());
}

// Debounced issue lookup function
const debouncedIssueLookup = debounce(async (index, term) => {
  if (!term.trim()) {
    delete issueSuggestions[index];
    delete validIssues[index];
    return;
  }

  loadingIssues[index] = true;
  try {
    // Determine search strategy based on input pattern
    let jql;
    let shouldValidateExact = false;
    let clientSideFilter = null;
    
    if (/^[A-Z][A-Z0-9]*-?\d*$/i.test(term)) {
      // Looks like a project key or issue key pattern (e.g., "ADM", "ADM-", "ADM-2")
      const upperTerm = term.toUpperCase();
      const projectKey = upperTerm.replace(/-\d*$/, '').replace(/-$/, '');
      
      if (isCompleteIssueKey(upperTerm)) {
        // For complete keys like "ADM-2", search within the project and filter client-side
        // This will show ADM-2, ADM-21, ADM-22, etc.
        jql = `project = "${projectKey}" AND issuetype in (Epic, Task, Story, Bug, "Production Bug", "Sub-task", Subtask) ORDER BY key ASC`;
        clientSideFilter = (issue) => issue.key.startsWith(upperTerm);
        shouldValidateExact = true;
      } else {
        // For partial keys like "ADM" or "ADM-", search within the project
        jql = `project = "${projectKey}" AND issuetype in (Epic, Task, Story, Bug, "Production Bug", "Sub-task", Subtask) ORDER BY created DESC`;
      }
    } else {
      // Text-based search in summary
      jql = `summary ~ "${term}*" AND issuetype in (Epic, Task, Story, Bug, "Production Bug", "Sub-task", Subtask) ORDER BY updated DESC`;
    }

    // Always fetch suggestions
    const body = {
      jql,
      fields: ["summary", "issuetype"],
      maxResults: clientSideFilter ? 50 : 10, // Get more results when we need to filter client-side
    };
    const res = await jiraFetch("rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify(body),
    });
    
    let suggestions = res.issues?.map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      issueType: i.fields.issuetype?.name,
    })) ?? [];
    
    // Apply client-side filtering if needed
    if (clientSideFilter) {
      suggestions = suggestions.filter(clientSideFilter).slice(0, 10); // Limit to 10 results
    }
    
    issueSuggestions[index] = suggestions;

    // If we should validate the exact match, check if it exists in the results
    if (shouldValidateExact) {
      const exactMatch = suggestions.find(s => s.key === term.toUpperCase());
      validIssues[index] = !!exactMatch;
    } else {
      validIssues[index] = false;
    }

  } catch (error) {
    console.error('Error searching issues:', error);
    validIssues[index] = false;
    delete issueSuggestions[index];
  } finally {
    loadingIssues[index] = false;
  }
}, 300);

// Handle dialog show/hide
watch(
  () => props.visible,
  (v) => {
    if (!dlg.value) return;
    if (v && !dlg.value.open) {
      // Store original state when modal opens
      originalDurations.value = [...ceremonyDurations.value];
      localDurations.value = [...ceremonyDurations.value];
      dlg.value.showModal();
      // Mark stored issue keys as valid (no API calls needed)
      markStoredKeysAsValid();
    } else if (!v && dlg.value.open) {
      dlg.value.close();
    }
  },
  { immediate: true }
);

let keydownHandler = null;

onMounted(() => {
  if (!dlg.value) return;
  dlg.value.addEventListener("close", () => emit("close"));
  if (visible.value && !dlg.value.open) {
    dlg.value.showModal();
  }
  
  // Hydrate ceremony durations from localStorage after client-side mount
  hydrateFromLocalStorage();
  
  // Handle escape key to use cancel behavior
  keydownHandler = (event) => {
    if (event.key === 'Escape' && visible.value) {
      event.preventDefault();
      cancelChanges();
    }
  };
  
  document.addEventListener('keydown', keydownHandler);
});

// Function to revert to original state
function revertToOriginal() {
  localDurations.value = [...originalDurations.value];
  // Mark original stored issue keys as valid (no API calls needed)
  markStoredKeysAsValid();
}

// Computed property to check if there are unsaved changes
const hasUnsavedChanges = computed(() => {
  // Compare local durations with original durations (not store)
  const originalState = originalDurations.value;
  
  // Different length means changes
  if (localDurations.value.length !== originalState.length) return true;
  
  // Compare each ceremony
  return localDurations.value.some((local, index) => {
    const original = originalState[index];
    if (!original) return true;
    
    return (
      local.label !== original.label ||
      local.hours !== original.hours ||
      local.issueKey !== original.issueKey
    );
  });
});

// Computed property to check if save should be disabled
const canSave = computed(() => {
  // Check if any fields are empty
  const hasEmptyFields = localDurations.value.some(c => !c.label.trim() || !c.issueKey.trim());
  if (hasEmptyFields) return false;
  
  // Check if any issue keys are invalid
  const hasInvalidKeys = localDurations.value.some((c, index) => {
    const hasIssueKey = c.issueKey && c.issueKey.trim();
    const isValidKey = validIssues[index] === true;
    const isLoading = loadingIssues[index] === true;
    
    // Invalid if there's an issue key but it's not valid and not loading
    return hasIssueKey && !isValidKey && !isLoading;
  });
  if (hasInvalidKeys) return false;
  
  // Check if any validations are in progress
  const hasLoadingKeys = Object.values(loadingIssues).some(loading => loading === true);
  if (hasLoadingKeys) return false;
  
  return true;
});

onBeforeUnmount(() => {
  debouncedIssueLookup.cancel();
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
  }
});

// Duration adjustment functions (now works with minutes)
function adjustDuration(index, deltaMinutes) {
  const ceremony = localDurations.value[index];
  if (!ceremony) return;

  const currentMinutes = getMinutesFromHours(ceremony.hours);
  const newMinutes = Math.max(15, Math.min(480, currentMinutes + deltaMinutes)); // 15m to 8h
  const newHours = newMinutes / 60;
  
  localDurations.value[index] = { ...ceremony, hours: newHours };
}

// Convert decimal hours to minutes
function getMinutesFromHours(hours) {
  return Math.round(hours * 60);
}

// Convert decimal hours to HH:MM format for time input
function formatHoursToTime(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Update duration from time input (HH:MM)
function updateDurationFromTime(index, timeValue) {
  const ceremony = localDurations.value[index];
  if (!ceremony) return;

  const [hours, minutes] = timeValue.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return;

  const totalMinutes = hours * 60 + minutes;
  const clampedMinutes = Math.max(15, Math.min(480, totalMinutes)); // 15m to 8h
  const newHours = clampedMinutes / 60;

  localDurations.value[index] = { ...ceremony, hours: newHours };
}

// Update ceremony field (label, issueKey, etc.)
function updateCeremonyField(index, field, value) {
  const ceremony = localDurations.value[index];
  if (!ceremony) return;

  localDurations.value[index] = { ...ceremony, [field]: value };
}

// Handle issue key changes
function updateIssueKey(index, value) {
  updateCeremonyField(index, 'issueKey', value);
  
  // Clear previous validation state
  delete validIssues[index];
  delete issueSuggestions[index];
  
  // Trigger debounced lookup
  debouncedIssueLookup(index, value);
}

// Handle issue key focus (trigger search if key exists)
function onIssueKeyFocus(index) {
  const ceremony = localDurations.value[index];
  if (ceremony?.issueKey) {
    debouncedIssueLookup(index, ceremony.issueKey);
  }
}

// Select suggestion from dropdown
function selectIssueSuggestion(index, suggestion) {
  updateCeremonyField(index, 'issueKey', suggestion.key);
  validIssues[index] = true;
  delete issueSuggestions[index];
}

// Add new ceremony
function addNewCeremony() {
  localDurations.value.push({
    label: '',
    hours: 1,
    issueKey: '',
  });
}

// Helper function to reindex validation state after row deletion
function reindexValidationState(deletedIndex) {
  // Get all existing indices to determine the range to work with
  const allIndices = [
    ...Object.keys(validIssues).map(Number),
    ...Object.keys(loadingIssues).map(Number),
    ...Object.keys(issueSuggestions).map(Number)
  ];
  const maxIndex = allIndices.length > 0 ? Math.max(...allIndices) : -1;
  
  // Create new state objects
  const newValidIssues = {};
  const newLoadingIssues = {};
  const newIssueSuggestions = {};
  
  // Process all indices up to the maximum found index
  for (let i = 0; i <= maxIndex; i++) {
    if (i < deletedIndex) {
      // Rows before deleted index stay at same position
      if (validIssues[i] !== undefined) newValidIssues[i] = validIssues[i];
      if (loadingIssues[i] !== undefined) newLoadingIssues[i] = loadingIssues[i];
      if (issueSuggestions[i] !== undefined) newIssueSuggestions[i] = issueSuggestions[i];
    } else if (i > deletedIndex) {
      // Rows after deleted index move up by one position
      if (validIssues[i] !== undefined) newValidIssues[i - 1] = validIssues[i];
      if (loadingIssues[i] !== undefined) newLoadingIssues[i - 1] = loadingIssues[i];
      if (issueSuggestions[i] !== undefined) newIssueSuggestions[i - 1] = issueSuggestions[i];
    }
    // Skip i === deletedIndex (the deleted row)
  }
  
  // Clear original state objects
  Object.keys(validIssues).forEach(key => delete validIssues[key]);
  Object.keys(loadingIssues).forEach(key => delete loadingIssues[key]);
  Object.keys(issueSuggestions).forEach(key => delete issueSuggestions[key]);
  
  // Apply new states
  Object.assign(validIssues, newValidIssues);
  Object.assign(loadingIssues, newLoadingIssues);
  Object.assign(issueSuggestions, newIssueSuggestions);
}

// Remove ceremony locally
function removeLocalCeremony(index) {
  if (confirm('Remove this ceremony?')) {
    localDurations.value.splice(index, 1);
    // Reindex validation state to maintain correct associations
    reindexValidationState(index);
  }
}

function resetToDefaults() {
  if (confirm('Reset all ceremony settings to their default values? This will not take effect until you click Save.')) {
    // Reset local copy only - don't call resetStore() until save
    localDurations.value = [
      { label: "Daily Stand-up", hours: 0.25, issueKey: "ADM-17" },
      { label: "Health Check", hours: 0.5, issueKey: "ADM-18" },
      { label: "Grooming", hours: 1, issueKey: "ADM-19" },
      { label: "Knowledge Sharing", hours: 1, issueKey: "ADM-20" },
      { label: "Planning", hours: 1, issueKey: "ADM-16" },
      { label: "Retrospective", hours: 1, issueKey: "ADM-18" },
    ];
    
    // Clear all validation state since we have a completely new array
    // For reset, we don't have cached validation, so clear everything
    Object.keys(loadingIssues).forEach(key => delete loadingIssues[key]);
    Object.keys(validIssues).forEach(key => delete validIssues[key]);
    Object.keys(issueSuggestions).forEach(key => delete issueSuggestions[key]);
    
    // Default values will show no validation indicators initially
    // Validation happens only when user interacts with the issue key fields
  }
}

function saveDurations() {
  // Validate all ceremonies have required fields
  const emptyFieldIndex = localDurations.value.findIndex(c => !c.label.trim() || !c.issueKey.trim());
  if (emptyFieldIndex >= 0) {
    addToast(`Please fill in all ceremony names and issue keys (row ${emptyFieldIndex + 1})`, 'error');
    return;
  }

  // Validate all issue keys are valid (no X signs)
  const invalidKeyIndex = localDurations.value.findIndex((c, index) => {
    const hasIssueKey = c.issueKey && c.issueKey.trim();
    const isValidKey = validIssues[index] === true;
    const isLoading = loadingIssues[index] === true;
    
    // If there's an issue key but it's not valid and not currently loading, it's invalid
    return hasIssueKey && !isValidKey && !isLoading;
  });
  
  if (invalidKeyIndex >= 0) {
    addToast(`Invalid issue key detected (row ${invalidKeyIndex + 1}). Please correct or remove invalid issue keys before saving.`, 'error');
    return;
  }

  // Check if any validations are still in progress
  const loadingIndex = Object.keys(loadingIssues).find(key => loadingIssues[key] === true);
  if (loadingIndex !== undefined) {
    addToast('Please wait for issue key validation to complete before saving.', 'warning');
    return;
  }

  // Update store with local changes (no need to store validation state)
  setCeremonies([...localDurations.value]);
  
  saveStore();
  addToast('Ceremony settings saved successfully', 'success');
  emit('saved');
  if (dlg.value && dlg.value.open) {
    dlg.value.close();
  }
  emit('close');
}

function cancelChanges() {
  // Check for unsaved changes and confirm with user
  if (hasUnsavedChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to cancel without saving?')) {
      return;
    }
  }
  
  // Revert to original state
  revertToOriginal();
  
  if (dlg.value && dlg.value.open) {
    dlg.value.close();
  }
  emit('close');
}

function closeModal() {
  // When clicking outside the modal (not the cancel button), 
  // warn about unsaved changes
  if (hasUnsavedChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
      return;
    }
    // If user confirms, revert to original state
    revertToOriginal();
  }
  
  if (dlg.value && dlg.value.open) {
    dlg.value.close();
  }
  emit('close');
}
</script>
