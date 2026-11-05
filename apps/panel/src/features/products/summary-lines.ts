/**
 * A product's short description as its lines (the owner, 2026-11-05:
 * "maddeler şeklinde"): up to five short plain lines shown under its name,
 * above the price. The server keeps the same bounds and tidies the lines
 * the same way; the editor keeps what it sends within them.
 */

export const SUMMARY_LIMITS = { lines: 5, length: 90 } as const

// Control and invisible formatting characters: the server refuses them
const HIDDEN = /[\p{Cc}\p{Cf}]/gu
// A marker a pasted list brings along: "•", "-", "*", "–", "✓", "1." or "1)"
const MARKER = /^(?:[•·▪◦‣∙*✓✔–—-]+|\d{1,2}[.)])\s+/u

/** A line as the server keeps it: one line of spaces, trimmed. */
export const normalizeLine = (text: string): string =>
  text.replace(HIDDEN, " ").replace(/\s+/g, " ").trim()

/** What is saved of the editor's rows: the lines with text, tidied. */
export const summaryOf = (rows: readonly string[]): string[] =>
  rows.map(normalizeLine).filter((line) => line !== "")

/** Whether two summaries say the same, row for row once tidied. */
export function sameSummary(a: readonly string[], b: readonly string[]): boolean {
  const left = summaryOf(a)
  const right = summaryOf(b)
  return left.length === right.length && left.every((line, index) => line === right[index])
}

/** Text pasted as several lines: one line each, list markers dropped, empty ones left out. */
export const pastedLines = (text: string): string[] =>
  text
    .split(/\r\n|\r|\n/)
    .map((line) => normalizeLine(line).replace(MARKER, ""))
    .filter((line) => line !== "")
    .map((line) => line.slice(0, SUMMARY_LIMITS.length))
