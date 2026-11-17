/** Where the browser remembers the connect tip was closed: once closed, it stays closed on every field. */
export const AI_HINT_KEY = "qt.panel.ai.hint.dismissed"

export function hintClosed(): boolean {
  try {
    return window.localStorage.getItem(AI_HINT_KEY) === "1"
  } catch {
    return false
  }
}

export function closeHint(): void {
  try {
    window.localStorage.setItem(AI_HINT_KEY, "1")
  } catch {
    // A browser that keeps nothing: closed for this visit only
  }
}
