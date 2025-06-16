import { ref } from 'vue'

// Reactive flag representing any background save operations in progress across the app.
// Components should set this to true when starting a save and back to false once finished.
const saving = ref(false)

export function useSavingIndicator () {
  return { saving }
} 