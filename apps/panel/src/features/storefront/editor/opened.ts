import type { SettingsPart } from "@/features/storefront/layout/settings-problems"

/** The panel open beside the page's parts; none: the list alone. */
export type Opened =
  | { kind: "section"; id: string }
  | { kind: "theme" }
  /** The theme's shared settings in the draft (adr/0049 Ek 2026-11-06). */
  | { kind: "shared"; part: SettingsPart }
  | null

/** What names the open panel, so the column starts at its top when another opens. */
export function formKeyOf(opened: Opened, sectionId: string | null): string | null {
  if (sectionId !== null) {
    return sectionId
  }
  if (opened?.kind === "shared") {
    return `shared:${opened.part}`
  }
  return opened?.kind === "theme" ? "theme" : null
}
