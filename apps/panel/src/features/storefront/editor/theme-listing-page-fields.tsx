import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { LISTING_COUNT_WORD_MAX, listingPageOf } from "@qticaret/types"
import type { ListingPageSettings } from "@qticaret/types"
import { LISTING_VIEWS } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { PanelGroup } from "./panel-header"
import { ChoiceSelect, SwitchRow } from "./theme-fields"
import { THEME_FIELD, THEME_GROUP_TITLES } from "./forms/theme-registry"

const C = "storefront.editor.theme"
const P = `${C}.listingPage`

/** The word as typed (a draft from before the group has none). */
const typedWord = (saved: Partial<ListingPageSettings> | undefined): string =>
  saved?.count_word ?? ""

interface ListingPageGroupProps {
  theme: ThemeSettings
  /** Opens the group now (the settings search's pick); null: none. */
  reveal: number | null
  onChange: (theme: ThemeSettings) => void
}

/**
 * "Liste sayfası": how the shop's listing pages (all products, a
 * category, a brand) lay out their products, shop-wide: a grid or one to
 * a row by default, whether the shopper may switch, and whether the trail
 * ends with the page itself, and the word after the count ("24 tur").
 * Every default is today's page; a draft from before the group reads at
 * its defaults.
 */
export function ListingPageGroup({ theme, reveal, onChange }: ListingPageGroupProps) {
  const { t } = useTranslation()
  const page = listingPageOf(theme.listing_page)
  const set = (patch: Partial<ListingPageSettings>) => {
    onChange({ ...theme, listing_page: { ...page, ...patch } })
  }
  const view = THEME_FIELD["listing_page.default_view"]
  const swap = THEME_FIELD["listing_page.view_switch"]
  const crumb = THEME_FIELD["listing_page.breadcrumb_current"]
  const word = THEME_FIELD["listing_page.count_word"]
  // As typed (its spaces too); the saved one is trimmed
  const rawWord = typedWord(theme.listing_page)
  return (
    <PanelGroup
      name="listingPage"
      title={t(THEME_GROUP_TITLES.listingPage)}
      hint={t(`${C}.listingPageHint`)}
      reveal={reveal}
    >
      <ChoiceSelect
        id={view.target}
        label={t(view.label)}
        value={page.default_view}
        options={LISTING_VIEWS}
        onChange={(value) => {
          set({ default_view: value })
        }}
        render={(option) => t(view.options[LISTING_VIEWS.indexOf(option)] ?? option)}
        hint={t(`${P}.default_view.hint`)}
      />
      <SwitchRow
        id={swap.target}
        label={t(swap.label)}
        hint={t(`${P}.view_switch.hint`)}
        checked={page.view_switch === "show"}
        onChange={(on) => {
          set({ view_switch: on ? "show" : "hide" })
        }}
      />
      <SwitchRow
        id={crumb.target}
        label={t(crumb.label)}
        hint={t(`${P}.breadcrumb_current.hint`)}
        checked={page.breadcrumb_current === "show"}
        onChange={(on) => {
          set({ breadcrumb_current: on ? "show" : "hide" })
        }}
      />
      <Field label={t(word.label)} htmlFor={word.target} hint={t(`${P}.count_word.hint`)}>
        <Input
          id={word.target}
          value={rawWord}
          maxLength={LISTING_COUNT_WORD_MAX}
          autoComplete="off"
          onChange={(event) => {
            const text = event.target.value
            set({ count_word: text.trim() === "" ? null : text })
          }}
        />
      </Field>
    </PanelGroup>
  )
}
