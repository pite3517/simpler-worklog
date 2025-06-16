import { reactive } from "vue";
import dayjs from "dayjs";
import { jiraFetch } from "~/composables/useJiraApi";
import { useJiraCredentials } from "~/composables/useJiraCredentials";

// Work-log item shape used across the app
export interface WorklogItem {
  id: string;
  issueKey: string;
  summary: string;
  timeSpentSeconds: number;
  issueType?: string;
}

// Cache of full work-log arrays keyed by YYYY-MM-DD (local)
const logsByDate = reactive<Record<string, WorklogItem[]>>({});

// Track months that have already been fetched so we do not hit Jira twice
const loadedMonths = new Set<string>();

// Keyed by yyyy-mm-dd in local time (ISO date string).
const hoursByDate = reactive<Record<string, number>>({});

// Track dates whose work-logs were just saved for transient UI highlight
const recentlyUpdated = reactive<Record<string, boolean>>({});
const highlightColorByDate = reactive<Record<string, 'success' | 'warning' | 'neutral'>>({});

export function useWorklogStore() {
  function setHours(date: Date, hours: number) {
    const key = dayjs(date).format("YYYY-MM-DD");
    hoursByDate[key] = hours;
  }

  function getHours(date: Date): number {
    const key = dayjs(date).format("YYYY-MM-DD");
    return hoursByDate[key] ?? 0;
  }

  /** Increment hours for a date by delta (can be negative) */
  function addHours(date: Date, delta: number) {
    const key = dayjs(date).format("YYYY-MM-DD");
    hoursByDate[key] = (hoursByDate[key] ?? 0) + delta;
  }

  function setLogs(date: Date, items: WorklogItem[]) {
    const key = dayjs(date).format("YYYY-MM-DD");
    logsByDate[key] = items;
    const totalSeconds = items.reduce(
      (s, it) => s + (it.timeSpentSeconds ?? 0),
      0
    );
    setHours(date, totalSeconds / 3600);
  }

  function getLogs(date: Date): WorklogItem[] {
    const key = dayjs(date).format("YYYY-MM-DD");
    return logsByDate[key] ?? [];
  }

  async function fetchMonth(monthDate: Date): Promise<void> {
    // Ensure we only hit Jira from the browser after hydration
    if (process.server) return
    // Skip any network calls if Jira credentials are not yet provided
    const { email, token } = useJiraCredentials()
    if (!email.value || !token.value) {
      return
    }
    // Month key YYYY-MM
    const monthKey = dayjs(monthDate).format("YYYY-MM");
    if (loadedMonths.has(monthKey)) return;

    loadedMonths.add(monthKey);

    const start = dayjs(monthDate).startOf("month").format("YYYY-MM-DD");
    const end = dayjs(monthDate).endOf("month").format("YYYY-MM-DD");
    // Jira worklog endpoint supports filtering by start timestamp (ms).
    const startedAfter = dayjs(start).valueOf();
    const startedBefore = dayjs(end).endOf("day").valueOf();

    try {
      // 1) Find issues having any work-logs by the user in the selected range
      const jql = `worklogAuthor = currentUser() AND worklogDate >= "${start}" AND worklogDate <= "${end}"`;
      const body = { jql, fields: ["summary", "issuetype"], maxResults: 5000 };
      const search = await jiraFetch<any>("rest/api/3/search/jql", {
        method: "POST",
        body: JSON.stringify(body),
      });

      // 2) Resolve current user accountId once for comparison
      const me = await jiraFetch<any>("rest/api/3/myself");
      const myAccountId: string | undefined = me.accountId;

      // 3) Iterate issues and collect work-logs (parallel per issue)
      const issues = search.issues ?? [];
      await Promise.all(
        issues.map(async (issue: any) => {
          const pageSize = 1000;
          let startAt = 0;
          while (true) {
            const wlResp = await jiraFetch<any>(
              `rest/api/3/issue/${issue.key}/worklog?maxResults=${pageSize}&startAt=${startAt}&startedAfter=${startedAfter}&startedBefore=${startedBefore}`
            );

            for (const w of wlResp.worklogs ?? []) {
              const startedDate = dayjs(w.started).format("YYYY-MM-DD");
              const isMe = w.author?.accountId
                ? w.author.accountId === myAccountId
                : w.author?.emailAddress === email.value;
              if (!isMe) continue;
              if (startedDate < start || startedDate > end) continue;

              const item: WorklogItem = {
                id: w.id,
                issueKey: issue.key,
                summary: issue.fields.summary,
                timeSpentSeconds: w.timeSpentSeconds,
                issueType: issue.fields.issuetype?.name,
              };

              // Initialise container for the date if missing
              if (!logsByDate[startedDate]) {
                logsByDate[startedDate] = [item];
              } else {
                // Avoid inserting duplicates that may already exist in the cache
                const exists = logsByDate[startedDate].some((l) => l.id === item.id);
                if (!exists) {
                  logsByDate[startedDate].push(item);
                }
              }

              // Keep hours tally in sync
              const dateObj = new Date(`${startedDate}T00:00:00`);
              const totalSeconds = logsByDate[startedDate].reduce(
                (s, it) => s + (it.timeSpentSeconds ?? 0),
                0
              );
              setHours(dateObj, totalSeconds / 3600);
            }

            // Break when we've fetched all pages
            startAt += pageSize;
            if (startAt >= (wlResp.total ?? 0)) break;
          }
        })
      );
    } catch (err) {
      // If the call fails we should allow another attempt later.
      loadedMonths.delete(monthKey);
      throw err;
    }
  }

  // Wipe all cached data – useful when credentials are cleared
  function clearAll() {
    for (const k in logsByDate) {
      delete logsByDate[k]
    }
    for (const k in hoursByDate) {
      delete hoursByDate[k]
    }
    loadedMonths.clear()
  }

  function determineColor(hours: number): 'success' | 'warning' | 'neutral' {
    if (hours >= 8) return 'success';
    if (hours > 0) return 'warning';
    return 'neutral';
  }

  /** Mark a date as just updated so UI can show a short highlight.
   *  Provide both previous and new hours to decide which colour to flash.
   *  If colour is changing to a coloured state (success/warning), flash the NEW full colour.
   *  Otherwise (colour removed or unchanged), flash the previous full colour (or neutral).
   */
  function markUpdated(date: Date, prevHours: number, newHours: number) {
    const key = dayjs(date).format("YYYY-MM-DD");
    recentlyUpdated[key] = true;
    const prevColor = determineColor(prevHours);
    const newColor = determineColor(newHours);

    // Decide which colour to flash
    let flashColor: 'success' | 'warning' | 'neutral' = prevColor;
    if (newColor !== prevColor) {
      // If transitioning to a coloured state, use new colour; if transitioning to neutral, keep previous.
      flashColor = newColor === 'neutral' ? prevColor : newColor;
    }

    highlightColorByDate[key] = flashColor;

    // Remove the flag & colour after 0.3s so the CSS transition can fade to new state
    setTimeout(() => {
      delete recentlyUpdated[key];
      delete highlightColorByDate[key];
    }, 700);
  }

  function getHighlightColor(date: Date): 'success' | 'warning' | 'neutral' {
    const key = dayjs(date).format("YYYY-MM-DD");
    return highlightColorByDate[key] ?? 'neutral';
  }

  function isRecentlyUpdated(date: Date): boolean {
    const key = dayjs(date).format("YYYY-MM-DD");
    return !!recentlyUpdated[key];
  }

  return {
    hoursByDate,
    logsByDate,
    setHours,
    getHours,
    addHours,
    setLogs,
    getLogs,
    fetchMonth,
    clearAll,
    markUpdated,
    getHighlightColor,
    isRecentlyUpdated,
  };
}
