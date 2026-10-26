import type { Grade } from "@/features/seo/api/advisor"

/** A grade's text colour: the colour supports the word, never replaces it. */
export const GRADE_TEXT: Record<Grade, string> = {
  excellent: "text-success-text",
  good: "text-info-text",
  needs_work: "text-warning-text",
  poor: "text-destructive-text",
}
