import { Palette } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { Panel } from "./panel-header"
import { ThemeForm } from "./theme-form"
import type { CardVariantsInUse, ThemeGroupName } from "./forms/theme-registry"
import { SettingsLayout } from "./settings-layout"
import type { FieldFocus } from "./use-field-focus"

const C = "storefront.editor.theme"

// The theme's settings stand in one list of closed groups, no tabs
const allContent = () => "content" as const

interface ThemePanelProps {
  /** The draft's theme settings. */
  theme: ThemeSettings
  /** The card variants the draft draws: a field meaningless for all of them is hidden. */
  variants: CardVariantsInUse
  /** The field the settings search picked; its group opens and it is marked. */
  focus: (FieldFocus & { group: ThemeGroupName }) | null
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
  variants,
  focus,
  problems,
  announcement,
  onChange,
  onUndo,
  onBack,
}: ThemePanelProps) {
  const { t } = useTranslation()
  return (
    <Panel icon={Palette} title={t(`${C}.title`)} onBack={onBack}>
      <SettingsLayout
        scope="theme"
        resetKey="theme"
        tabOf={allContent}
        tabbed={false}
        searchLabel="storefront.editor.panelSearch.themeLabel"
        searchPlaceholder="storefront.editor.panelSearch.themePlaceholder"
        focus={focus}
      >
        <ThemeForm
          theme={theme}
          variants={variants}
          reveal={(group) => (focus?.group === group ? focus.nonce : null)}
          problems={problems}
          announcement={announcement ?? t(`${C}.sampleLine`)}
          onChange={onChange}
          onUndo={onUndo}
        />
      </SettingsLayout>
    </Panel>
  )
}
