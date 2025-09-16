import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

interface IssueHourPair {
  issueKey: string
  hours: number
}

interface WeekConfig {
  monday: IssueHourPair[]
  tuesday: IssueHourPair[]
  wednesday: IssueHourPair[]
  thursday: IssueHourPair[]
  friday: IssueHourPair[]
}

interface TeamConfig {
  name: string
  week1OfSprint: WeekConfig
  week2OfSprint: WeekConfig
}

interface TeamsConfig {
  teams: Record<string, TeamConfig>
}

const teamsConfig = ref<TeamsConfig | null>(null)
const selectedTeam = ref<string>('')

export const useTeamCeremonies = () => {
  const loadTeamsConfig = async () => {
    try {
      // Import the JSON config file
      const config = await import('~/presets/team-ceremonies.json')
      teamsConfig.value = config.default || config
    } catch (error) {
      console.error('Failed to load team ceremonies config:', error)
      teamsConfig.value = null
    }
  }

  const availableTeams = computed(() => {
    if (!teamsConfig.value) return []
    return Object.entries(teamsConfig.value.teams).map(([key, team]) => ({
      key,
      name: team.name
    }))
  })

  const currentTeamConfig = computed(() => {
    if (!teamsConfig.value || !selectedTeam.value) return null
    return teamsConfig.value.teams[selectedTeam.value]
  })

  /**
   * Get ceremony tasks for a specific date based on team configuration
   */
  const getCeremonyTasksForDate = (date: dayjs.Dayjs, teamKey?: string): Array<{ issueKey: string, hours: number }> => {
    const teamConfig = teamKey 
      ? teamsConfig.value?.teams[teamKey] 
      : currentTeamConfig.value

    if (!teamConfig) return []

    const weekday = date.day() // 0 = Sun .. 6 = Sat
    
    // Skip weekends
    if (weekday === 0 || weekday === 6) return []

    // Determine if it's week 1 or week 2 of the sprint
    // We'll use ISO week number to determine sprint week
    // Week 1: odd ISO weeks, Week 2: even ISO weeks
    const isoWeek = date.isoWeek()
    const sprintWeek = isoWeek % 2 === 1 ? 'week1OfSprint' : 'week2OfSprint'
    
    // Map day numbers to day names
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[weekday] as keyof WeekConfig

    // Get the appropriate week configuration
    const weekConfig = teamConfig[sprintWeek]
    if (!weekConfig || !weekConfig[dayName]) return []

    // Return all tasks for this day
    return weekConfig[dayName] || []
  }

  return {
    teamsConfig: readonly(teamsConfig),
    selectedTeam,
    availableTeams,
    currentTeamConfig,
    loadTeamsConfig,
    getCeremonyTasksForDate
  }
}
