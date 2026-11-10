import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { Grade, Severity } from "@/features/seo/api/advisor"

/** A grade's text colour: the colour supports the word, never replaces it. */
export const GRADE_TEXT: Record<Grade, string> = {
  excellent: "text-success-text",
  good: "text-info-text",
  needs_work: "text-warning-text",
  poor: "text-destructive-text",
}

/** A finding's badge by how much it costs the page (docs/14 §2). */
export const SEVERITY_TONES: Record<Severity, StatusTone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
  info: "neutral",
}
