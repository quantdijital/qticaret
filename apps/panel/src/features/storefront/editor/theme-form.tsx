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
import { ListingPageGroup } from "./theme-listing-page-fields"
import { KitChoice } from "./theme-style-kit-fields"
import { ListingTextGroup } from "./theme-listing-text-fields"
import { SearchFormGroup } from "./theme-search-form-fields"
import { BackgroundField, ColorInput } from "./theme-fields"
import { ThemeSample } from "./theme-sample"
import { Hint } from "./shared/hint"
import { THEME_GROUP_TITLES, THEME_IDS } from "./forms/theme-registry"
import type { CardVariantsInUse, ThemeGroupName } from "./forms/theme-registry"

const C = "storefront.editor.theme"

interface ThemeFormProps {
  /** The draft's theme (the theme section's until the shop writes it there). */
  theme: ThemeSettings
  /** The card variants the draft draws. */
  variants: CardVariantsInUse
  /** A group to open now (the settings search's pick): a fresh number each time; null: none. */
  reveal: (group: ThemeGroupName) => number | null
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
 * the product card, the header and the listing pages' text, from the
 * server's fixed lists; the
 * sample draws them as the theme does. Part of the draft (adr/0063 §3):
 * each change is saved with the design, shown in the preview, undone with
 * it and put live by "Yayınla". "Grafit'e dön" puts the theme's defaults
 * in the draft, one step to undo.
 */
export function ThemeForm({
  theme,
  variants,
  reveal,
  problems,
  announcement,
  onChange,
  onUndo,
}: ThemeFormProps) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const shown = themeValuesOf(theme)
  const { colors } = theme
  const toGrafit = () => {
    // The search box's fields are not the look (adr/0077 §1): the shop's stay
    onChange({
      ...theme,
      ...GRAFIT_THEME,
      search_form: theme.search_form,
      listing_page: theme.listing_page,
    })
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
      <PanelGroup name="colors" title={t(THEME_GROUP_TITLES.colors)} reveal={reveal("colors")}>
        <ColorInput
          id={THEME_IDS["colors.primary"]}
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
          id={THEME_IDS["colors.accent"]}
          label={t(`${C}.accent`)}
          hint={t(`${C}.accentHint`)}
          value={shown.colors.accent}
          onChange={(value) => {
            onChange({ ...theme, colors: { ...colors, accent: orNull(value) } }, "colors.accent")
          }}
          fallback={ATOLYE_COLORS.text}
          error={problem(problems["theme.colors.accent"])}
        />
        <KitChoice field="accent_ink" theme={theme} variants={variants} onChange={onChange} />
        <BackgroundField
          id={THEME_IDS["colors.background"]}
          value={colors.background}
          onChange={(background) => {
            onChange({ ...theme, colors: { ...colors, background } })
          }}
        />
      </PanelGroup>
      <ThemeChoices
        theme={theme}
        variants={variants}
        reveal={reveal}
        onChange={(next) => {
          onChange(next)
        }}
      />
      <ListingTextGroup
        theme={theme}
        reveal={reveal("listingText")}
        onChange={(next) => {
          onChange(next)
        }}
      />
      <ListingPageGroup
        theme={theme}
        reveal={reveal("listingPage")}
        onChange={(next) => {
          onChange(next)
        }}
      />
      <SearchFormGroup
        theme={theme}
        reveal={reveal("searchForm")}
        onChange={(next) => {
          onChange(next)
        }}
      />
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t bg-card px-5 py-3">
        <Hint label={t(`${C}.grafit.hint`)} side="top" align="end" describe wrap>
          <Button type="button" variant="outline" disabled={isGrafit(shown)} onClick={toGrafit}>
            {t(`${C}.grafit.action`)}
          </Button>
        </Hint>
      </div>
    </div>
  )
}
