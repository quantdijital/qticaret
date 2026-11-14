import { Palette } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { Panel } from "./panel-header"
import { ThemeForm } from "./theme-form"

const C = "storefront.editor.theme"

interface ThemePanelProps {
  /** The draft's theme settings. */
  theme: ThemeSettings
  /** The settings' problems; the theme's are under `theme.`. */
  problems: SectionProblems
  /** The first announcement line, for the sample. */
  announcement: string | null
  onChange: (theme: ThemeSettings, field?: string) => void
  onUndo: () => void
  onBack: () => void
}

/**
 * The theme's own settings (adr/0049 §6.4, adr/0053 §B): part of the draft
 * since adr/0063 §3, saved with the design and published by "Yayınla".
 */
export function ThemePanel({
  theme,
  problems,
  announcement,
  onChange,
  onUndo,
  onBack,
}: ThemePanelProps) {
  const { t } = useTranslation()
  return (
    <Panel icon={Palette} title={t(`${C}.title`)} onBack={onBack}>
      <ThemeForm
        theme={theme}
        problems={problems}
        announcement={announcement ?? t(`${C}.sampleLine`)}
        onChange={onChange}
        onUndo={onUndo}
      />
    </Panel>
  )
}
