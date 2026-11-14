import type { Dispatch } from "react"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { SETTINGS_KEY, partProblems } from "@/features/storefront/layout/settings-problems"
import { groupLimit, isBodyGroup, marqueesOn } from "@/features/storefront/layout/sections"
import { MARQUEE_LIMITS } from "@/features/storefront/api/layout"
import type { findSection } from "@/features/storefront/layout/sections"
import type { AnySection } from "@/features/storefront/api/layout"
import type { Opened } from "./opened"
import { SectionPanel } from "./section-panel"
import { LooksPanel } from "./shared/looks-panel"
import { ThemePanel } from "./theme-panel"

interface OpenedFormProps {
  opened: Opened
  /** The open section where it is in the draft; null: no section is open. */
  found: ReturnType<typeof findSection>
  doc: LayoutDocument
  problems: Map<string, SectionProblems>
  dispatch: Dispatch<EditorAction>
  onUndo: () => void
  onRemove: (section: AnySection) => void
  onClose: () => void
}

/**
 * The theme editor's open panel (adr/0049): the open section's settings,
 * the theme's settings (adr/0063 §3) or the stock line and colour names,
 * each writing to the draft; nothing open: nothing.
 */
export function OpenedForm({
  opened,
  found,
  doc,
  problems,
  dispatch,
  onUndo,
  onRemove,
  onClose,
}: OpenedFormProps) {
  const settingsProblems = problems.get(SETTINGS_KEY) ?? {}
  if (found) {
    return (
      <SectionPanel
        section={found.section}
        group={found.group}
        problems={problems.get(found.section.id) ?? {}}
        canDuplicate={
          isBodyGroup(found.group) &&
          doc[found.group].length < groupLimit(found.group) &&
          // A page shows two scrolling strips at most, the header's counted
          (found.section.type !== "marquee" ||
            marqueesOn(doc, found.group) < MARQUEE_LIMITS.perPage)
        }
        onChange={(section, field) => {
          dispatch({ type: "update", section, merge: field ? `${section.id}:${field}` : undefined })
        }}
        onPlace={(placement) => {
          dispatch({ type: "place", id: found.section.id, placement })
        }}
        onBack={onClose}
        onDuplicate={() => {
          dispatch({ type: "duplicate", id: found.section.id })
        }}
        onRemove={() => {
          onRemove(found.section)
        }}
        focus={opened?.kind === "section" ? (opened.focus ?? null) : null}
        badges={doc.settings.trust_badges}
        onBadges={(trust_badges, field) => {
          dispatch({ type: "settings", settings: { ...doc.settings, trust_badges }, merge: field })
        }}
      />
    )
  }
  if (opened?.kind === "looks") {
    return (
      <LooksPanel
        settings={doc.settings}
        problems={settingsProblems}
        onChange={(settings, field) => {
          dispatch({ type: "settings", settings, merge: field })
        }}
        onBack={onClose}
      />
    )
  }
  if (opened?.kind === "theme") {
    return (
      <ThemePanel
        theme={doc.settings.theme}
        problems={partProblems(settingsProblems, "theme")}
        announcement={
          doc.header
            .flatMap((section) => (section.type === "announcement_bar" ? section.lines : []))
            .find((line) => line.trim() !== "") ?? null
        }
        onChange={(theme, field) => {
          dispatch({
            type: "settings",
            settings: { ...doc.settings, theme },
            merge: field ? `theme.${field}` : undefined,
          })
        }}
        onUndo={onUndo}
        onBack={onClose}
      />
    )
  }
  return null
}
