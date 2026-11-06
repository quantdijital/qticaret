/** The panel open beside the page's parts; none: the list alone. */
export type Opened =
  | { kind: "section"; id: string }
  | { kind: "theme" }
  /** The stock line and colour names, drafted with the design (adr/0049 Ek 2026-11-06). */
  | { kind: "looks" }
  | null

/** What names the open panel, so the column starts at its top when another opens. */
export function formKeyOf(opened: Opened, sectionId: string | null): string | null {
  if (sectionId !== null) {
    return sectionId
  }
  return opened?.kind === "theme" || opened?.kind === "looks" ? opened.kind : null
}
