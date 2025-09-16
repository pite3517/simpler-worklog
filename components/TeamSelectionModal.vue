<template>
  <dialog v-if="visible" class="modal modal-open">
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-lg mb-4">Select Team Configuration</h3>
      <p class="text-sm text-base-content/80 mb-6">
        Choose which team's ceremony configuration to use for auto-filling worklogs.
      </p>
      
      <div v-if="availableTeams.length === 0" class="text-center py-8">
        <p class="text-base-content/60">No team configurations available.</p>
      </div>
      
      <div v-else class="space-y-3">
        <div
          v-for="team in availableTeams"
          :key="team.key"
          class="card card-compact bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
          :class="{ 'ring-2 ring-primary': selectedTeamKey === team.key }"
          @click="selectedTeamKey = team.key"
        >
          <div class="card-body">
            <div class="flex items-center gap-3">
              <input
                type="radio"
                class="radio radio-primary radio-sm"
                :checked="selectedTeamKey === team.key"
                :value="team.key"
                @change="selectedTeamKey = team.key"
              >
              <div class="flex-1">
                <h4 class="font-semibold">{{ team.name }}</h4>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-action mt-6">
        <button class="btn btn-ghost" @click="$emit('close')">
          Cancel
        </button>
        <button 
          class="btn btn-primary" 
          :disabled="!selectedTeamKey"
          @click="handleConfirm"
        >
          Auto-Fill Ceremonies
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @submit.prevent="$emit('close')">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  availableTeams: Array,
  defaultSelectedTeam: String
})

const emit = defineEmits(['close', 'confirm'])

const selectedTeamKey = ref('')

// Set default selection when modal opens
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    selectedTeamKey.value = props.defaultSelectedTeam || ''
  }
})

const handleConfirm = () => {
  if (selectedTeamKey.value) {
    emit('confirm', selectedTeamKey.value)
  }
}
</script>
