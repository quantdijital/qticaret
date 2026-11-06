import type { LayoutSettings } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"

/** What a panel of the theme's shared settings (adr/0049 Ek 2026-11-06) is given. */
export interface SharedPanelProps {
  settings: LayoutSettings
  /** The settings' mistakes by field (`trust_badges.0.title`), as the save would meet them. */
  problems: SectionProblems
  /** The new settings; `field` names the field being typed in (one undo step per field). */
  onChange: (settings: LayoutSettings, field?: string) => void
  onBack: () => void
}
