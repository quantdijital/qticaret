/**
 * A section's dates as a `datetime-local` field holds them: the moment in
 * the browser's own time, minutes only. The server keeps an ISO-8601
 * moment with its offset (UTC here).
 */

const pad = (value: number) => String(value).padStart(2, "0")

/** `2026-11-20T09:00` for a stored moment; empty for none or a broken one. */
export function toLocalInput(iso: string | null): string {
  if (!iso) {
    return ""
  }
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) {
    return ""
  }
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(
    at.getHours()
  )}:${pad(at.getMinutes())}`
}

/** The moment a field holds, as the server takes it; none when empty or unreadable. */
export function fromLocalInput(value: string): string | null {
  if (value.trim() === "") {
    return null
  }
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}
