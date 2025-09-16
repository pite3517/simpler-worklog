import { ref, watch } from 'vue'

const STORAGE_KEY = 'simpler-worklog-selected-team'

// Reactive ref for the selected team
const selectedTeam = ref<string>('')

export const useSelectedTeam = () => {
  // Load saved team from localStorage on initialization
  const loadSavedTeam = () => {
    if (import.meta.server) return // Skip on server-side rendering
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        selectedTeam.value = saved
      }
    } catch (error) {
      console.warn('Failed to load saved team from localStorage:', error)
    }
  }

  // Save team to localStorage
  const saveTeam = (teamKey: string) => {
    if (import.meta.server) return // Skip on server-side rendering
    
    try {
      localStorage.setItem(STORAGE_KEY, teamKey)
      selectedTeam.value = teamKey
    } catch (error) {
      console.warn('Failed to save team to localStorage:', error)
    }
  }

  // Clear saved team
  const clearSavedTeam = () => {
    if (import.meta.server) return // Skip on server-side rendering
    
    try {
      localStorage.removeItem(STORAGE_KEY)
      selectedTeam.value = ''
    } catch (error) {
      console.warn('Failed to clear saved team from localStorage:', error)
    }
  }

  // Watch for changes and auto-save (optional, for future use)
  watch(selectedTeam, (newTeam) => {
    if (newTeam && !import.meta.server) {
      try {
        localStorage.setItem(STORAGE_KEY, newTeam)
      } catch (error) {
        console.warn('Failed to auto-save team to localStorage:', error)
      }
    }
  })

  return {
    selectedTeam: readonly(selectedTeam),
    loadSavedTeam,
    saveTeam,
    clearSavedTeam
  }
}
