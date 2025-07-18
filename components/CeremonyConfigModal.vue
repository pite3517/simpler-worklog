<template>
  <Teleport to="body">
    <div v-if="visible" class="modal modal-open" @click.self="$emit('close')">
      <div class="modal-box w-11/12 max-w-5xl relative">
        <h3 class="font-bold text-lg">Configure Ceremony Mappings</h3>
        <p class="py-2 text-sm">
          <span v-if="eventData.length > 0" class="text-blue-600 font-medium">
            📅 Auto-filled from calendar:
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
              <span v-if="eventData.length > 0" class="text-blue-600">
                (recommended)
              </span>
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
          <div class="overflow-x-auto">
            <table class="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Event Title</th>
                  <th>JIRA Issue Key</th>
                  <th>Dates</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(event, index) in eventData" :key="index">
                  <td class="font-medium">{{ event.title }}</td>
                  <td>
                    <input
                      v-model="event.issueKey"
                      type="text"
                      class="input input-bordered input-sm w-full"
                      placeholder="e.g. ADM-10"
                    />
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

// addNewConfig function removed as it's not used anymore

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
