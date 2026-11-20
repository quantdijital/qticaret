/**
 * Each table of the text in a box of its own that scrolls sideways when
 * the table is wider than a phone (one tab stop, named by its place in
 * the text, docs/19 §6.9).
 * The backend writes a bare `<table>` (adr/0019), so the box goes around
 * it here; nothing else of the text changes.
 */
export function withTableBoxes(html: string, label: (n: number) => string): string {
  let n = 0
  const name = (text: string) =>
    text.replace(/[&<>"]/g, (char) => `&#${String(char.charCodeAt(0))};`)
  return html
    .replace(/<table>/g, () => {
      n += 1
      return `<div class="gf-table" role="region" tabindex="0" aria-label="${name(label(n))}"><table>`
    })
    .replaceAll("</table>", "</table></div>")
}

/** The shop's text as it wrote it (adr/0019: the backend's allow-listed HTML); nothing when empty. */
export function Prose({
  html,
  className,
  tableLabel,
  mark,
}: {
  html: string
  className?: string
  /** The name of the text's n-th table's scrolling box; given, each table gets one. */
  tableLabel?: (n: number) => string
  /** Its field mark in the theme editor's preview (`fieldMark`, adr/0065 Faz 2b); none elsewhere. */
  mark?: { "data-qf"?: string } | undefined
}) {
  return html ? (
    <div
      className={`gf-prose ${className ?? ""}`}
      // adr/0019: built by the backend from an allow-listed document schema
      dangerouslySetInnerHTML={{ __html: tableLabel ? withTableBoxes(html, tableLabel) : html }}
      {...mark}
    />
  ) : null
}
