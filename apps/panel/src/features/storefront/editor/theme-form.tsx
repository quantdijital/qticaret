import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { isGrafit, themeValuesOf } from "@/features/storefront/theme-settings"
import { ATOLYE_COLORS } from "@/theme/atolye"
import { useProblemText } from "./forms/problem-text"
import { PanelGroup } from "./panel-header"
import { ThemeChoices } from "./theme-choices"
import { BackgroundField, ColorInput } from "./theme-fields"
import { ThemeSample } from "./theme-sample"

const C = "storefront.editor.theme"

interface ThemeFormProps {
  /** The draft's theme (the theme section's until the shop writes it there). */
  theme: ThemeSettings
  /** Its problems by field (`theme.colors.primary`), as the document's settings hold them. */
  problems: SectionProblems
  /** The first announcement line, for the sample. */
  announcement: string
  /** The theme changed; `field` names the one being typed in (one undo step). */
  onChange: (theme: ThemeSettings, field?: string) => void
  /** "Grafit'e dön" taken back. */
  onUndo: () => void
}

// A colour field holds "" for none; the draft holds null
const orNull = (value: string): string | null => (value === "" ? null : value)

/**
 * The theme's settings (adr/0053 §B, adr/0062): colours, faces, corners,
 * the product card and the header, from the server's fixed lists; the
 * sample draws them as the theme does. Part of the draft (adr/0063 §3):
 * each change is saved with the design, shown in the preview, undone with
 * it and put live by "Yayınla". "Grafit'e dön" puts the theme's defaults
 * in the draft, one step to undo.
 */
export function ThemeForm({ theme, problems, announcement, onChange, onUndo }: ThemeFormProps) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const shown = themeValuesOf(theme)
  const { colors } = theme
  const toGrafit = () => {
    onChange({ ...theme, ...GRAFIT_THEME })
    toast.success(t(`${C}.grafit.done`), {
      action: { label: t("storefront.editor.undo"), onClick: onUndo },
    })
  }
  return (
    <div className="flex flex-col">
      <p className="border-b px-5 py-4 text-[13px] leading-5 text-muted-foreground">
        {t(`${C}.live`)}
      </p>
      <div className="border-b px-5 py-4">
        <ThemeSample values={shown} announcement={announcement} />
      </div>
      <PanelGroup title={t(`${C}.colors`)}>
        <ColorInput
          id="theme-primary"
          label={t(`${C}.primary`)}
          hint={t(`${C}.primaryHint`)}
          value={shown.colors.primary}
          onChange={(value) => {
            onChange({ ...theme, colors: { ...colors, primary: orNull(value) } }, "colors.primary")
          }}
          fallback={ATOLYE_COLORS.wine}
          error={problem(problems["theme.colors.primary"])}
        />
        <ColorInput
          id="theme-accent"
          label={t(`${C}.accent`)}
          hint={t(`${C}.accentHint`)}
          value={shown.colors.accent}
          onChange={(value) => {
            onChange({ ...theme, colors: { ...colors, accent: orNull(value) } }, "colors.accent")
          }}
          fallback={ATOLYE_COLORS.text}
          error={problem(problems["theme.colors.accent"])}
        />
        <BackgroundField
          value={colors.background}
          onChange={(background) => {
            onChange({ ...theme, colors: { ...colors, background } })
          }}
        />
      </PanelGroup>
      <ThemeChoices
        theme={theme}
        onChange={(next) => {
          onChange(next)
        }}
      />
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t bg-card px-5 py-3">
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          title={t(`${C}.grafit.hint`)}
          disabled={isGrafit(shown)}
          onClick={toGrafit}
        >
          {t(`${C}.grafit.action`)}
        </Button>
      </div>
    </div>
  )
}
