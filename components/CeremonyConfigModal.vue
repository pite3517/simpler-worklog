<template>
  <dialog class="modal" :class="{ 'modal-open': visible }">
    <div class="modal-box w-11/12 max-w-3xl">
      <h3 class="font-bold text-lg">Configure Ceremony Mappings</h3>
      <p class="py-2 text-sm">
        Map calendar event titles to JIRA issues for automatic work logging.
        Click "Save" to apply your changes.
      </p>

      <!-- Upload calendar section -->
      <div class="form-control mb-4 w-full">
        <label class="label">
          <span class="font-bold flex items-center gap-2">
            Upload your calendar (.ics)
            <Icon
              v-if="hasStoredIcs"
              name="lucide:check-circle"
              class="w-5 h-5 text-success"
              title="Calendar file is stored"
            />
          </span>
        </label>
        <div>
          <!-- Hidden file input for ICS upload -->
          <input
            ref="icsFileInput"
            type="file"
            accept=".ics"
            class="hidden"
            @change="handleIcsFileSelect"
          />
          <button class="btn btn-sm btn-outline" @click="triggerIcsSelect">
            Choose .ics file
          </button>
        </div>
      </div>

      <!-- Team preset selector -->
      <div class="form-control w-48 mb-2">
        <label class="label" for="teamPreset">
          <span class="label-text">Team preset</span>
        </label>
        <select
          id="teamPreset"
          class="select select-sm select-bordered"
          @change="onPresetChange($event)"
        >
          <option value="">-- Select preset --</option>
          <option value="sally">Sally</option>
          <option value="pangyo">Pangyo</option>
        </select>
      </div>

      <div class="overflow-x-auto max-h-78 overflow-y-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Event Title Contains</th>
              <th>JIRA Issue Key</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(config, index) in configs" :key="index">
              <td>
                <input
                  v-model="config.title"
                  type="text"
                  class="input input-bordered input-sm w-full"
                  placeholder="e.g. Standup"
                />
              </td>
              <td>
                <input
                  v-model="config.issueKey"
                  type="text"
                  class="input input-bordered input-sm w-full"
                  placeholder="e.g. ADM-10"
                />
              </td>
              <td>
                <button
                  class="btn btn-sm btn-ghost"
                  @click="removeConfig(index)"
                >
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center mt-4">
        <button class="btn btn-sm btn-secondary" @click="addNewConfig">
          Add Row
        </button>
        <div class="flex items-center gap-2">
          <!-- Hidden file input for CSV import -->
          <input
            ref="csvFileInput"
            type="file"
            accept=".csv"
            class="hidden"
            @change="handleCsvFileSelect"
          />
          <button class="btn btn-sm btn-outline" @click="triggerCsvSelect">
            Import CSV
          </button>
          <button class="btn btn-sm btn-outline" @click="exportCsv">
            Export CSV
          </button>
        </div>
      </div>

      <!-- CSV Preview Section -->
      <div v-if="csvPreview.length > 0" class="mt-4">
        <div class="alert alert-info mb-4">
          <div>
            <h4 class="font-semibold">Preview of CSV Import (first 5 rows):</h4>
            <div class="overflow-x-auto mt-2">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th>Title/Keyword</th>
                    <th>Issue Key</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, index) in csvPreview.slice(0, 5)"
                    :key="index"
                  >
                    <td>{{ row.title }}</td>
                    <td>{{ row.issueKey }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="csvPreview.length > 5" class="text-xs text-gray-500 mt-1">
              ... and {{ csvPreview.length - 5 }} more rows
            </p>
            <div class="mt-2 flex gap-2">
              <button
                class="btn btn-sm btn-primary"
                :disabled="csvUploading"
                @click="applyCsvConfig"
              >
                <span
                  v-if="csvUploading"
                  class="loading loading-spinner loading-sm"
                />
                Apply CSV Data
              </button>
              <button class="btn btn-sm" @click="cancelCsvImport">
                Cancel Import
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-primary" @click="saveConfigs">Save</button>
        <button class="btn" @click="$emit('close')">Close</button>
      </div>
    </div>
    <form
      method="dialog"
      class="modal-backdrop"
      @submit.prevent="$emit('close')"
    >
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
// @ts-nocheck
import { useCeremonyConfig } from "~/composables/useCeremonyConfig";
import { useToastStore } from "~/composables/useToastStore";
import { ref, computed } from "vue";
// Import preset CSVs as raw text so we can parse them on demand
// Using Vite raw plugin syntax – supported by Nuxt 3.
// Ensure the files exist in project root (or move to assets if needed)
import sallyMappings from "~/presets/sally-mappings.json";
import pangyoMappings from "~/presets/pangyo-mappings.json";
import { saveIcsContent, storedIcs } from "~/composables/useIcsStorage";

defineProps({
  visible: Boolean,
});
const emit = defineEmits(["close"]);

const {
  configs,
  addConfig,
  removeConfig,
  saveConfigs: saveConfigsToStore,
  setConfigs,
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

  setConfigs(mappings);
  addToast(`Loaded ${mappings.length} mappings from ${key} preset`, "success");
}

function onPresetChange(e) {
  const key = e.target.value;
  if (key) {
    loadPreset(key);
    // Reset selector back to empty for clarity
    e.target.value = "";
  }
}

// CSV handling
const csvFileInput = ref(null);
const csvPreview = ref([]);
const csvUploading = ref(false);

// ICS handling
const icsFileInput = ref(null);

const hasStoredIcs = computed(() => !!storedIcs.value);

function addNewConfig() {
  addConfig({ title: "", issueKey: "" });
}

function saveConfigs() {
  saveConfigsToStore();
  addToast("Ceremony configurations saved successfully!", "success");

  // Close the modal
  emit("close");
}

function exportCsv() {
  if (configs.value.length === 0) {
    return;
  }

  // Create CSV content
  const csvContent = generateCsvContent(configs.value);

  // Create and download the file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `ceremony-mappings-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function generateCsvContent(configs) {
  // Start with headers
  let csv = "title,issueKey\n";

  // Add each config row
  configs.forEach((config) => {
    // Escape titles that contain commas by wrapping in quotes
    const title = config.title.includes(",")
      ? `"${config.title}"`
      : config.title;
    csv += `${title},${config.issueKey}\n`;
  });

  return csv;
}

function triggerCsvSelect() {
  csvFileInput.value?.click();
}

async function handleCsvFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rows = text
      .split("\n")
      .map((row) => row.trim())
      .filter((row) => row);
    const headers = parseCSVRow(rows[0]);

    if (!headers.includes("title") || !headers.includes("issueKey")) {
      addToast("CSV must have 'title' and 'issueKey' columns", "error");
      return;
    }

    const titleIndex = headers.indexOf("title");
    const issueKeyIndex = headers.indexOf("issueKey");

    const parsedRows = rows.slice(1).map((row) => {
      const columns = parseCSVRow(row);
      return {
        title: columns[titleIndex] || "",
        issueKey: columns[issueKeyIndex] || "",
      };
    });

    csvPreview.value = parsedRows;
  } catch (error) {
    addToast("Failed to parse CSV file", "error");
    console.error("CSV parse error:", error);
  }

  // Reset file input
  event.target.value = "";
}

function applyCsvConfig() {
  if (!csvPreview.value.length) return;

  try {
    csvUploading.value = true;
    // Replace existing configs with CSV data
    setConfigs(csvPreview.value);
    addToast("CSV configuration applied successfully!", "success");

    // Clear preview
    csvPreview.value = [];
  } catch (error) {
    addToast("Failed to apply CSV configuration", "error");
    console.error("CSV apply error:", error);
  } finally {
    csvUploading.value = false;
  }
}

function cancelCsvImport() {
  csvPreview.value = [];
}

// Helper function to properly parse CSV rows with quoted strings
function parseCSVRow(row) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Handle escaped quotes (two double quotes in a row)
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // Add the last field
  result.push(current.trim());
  return result;
}

function triggerIcsSelect() {
  icsFileInput.value?.click();
}

async function handleIcsFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.name.endsWith(".ics")) {
    addToast("Please select a valid .ics file.", "error");
    event.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    saveIcsContent(text);
    addToast("Calendar file stored successfully!", "success");
  } catch (error) {
    console.error("ICS read error:", error);
    addToast("Failed to read the .ics file.", "error");
  }

  // Reset file input
  event.target.value = "";
}
</script>
