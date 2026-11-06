import type { Dispatch } from "react"
import type { LayoutSettings } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import type { SettingsPart } from "@/features/storefront/layout/settings-problems"
import { LooksPanel } from "./looks-panel"
import { TrustBadgesPanel } from "./trust-badges-panel"

/** One panel of the theme's shared settings, its changes going to the draft as a section's do. */
export function SharedPanel({
  part,
  settings,
  problems,
  dispatch,
  onBack,
}: {
  part: SettingsPart
  settings: LayoutSettings
  problems: SectionProblems
  dispatch: Dispatch<EditorAction>
  onBack: () => void
}) {
  const props = {
    settings,
    problems,
    onBack,
    onChange: (next: LayoutSettings, field?: string) => {
      dispatch({ type: "settings", settings: next, merge: field })
    },
  }
  return part === "trust_badges" ? <TrustBadgesPanel {...props} /> : <LooksPanel {...props} />
}
