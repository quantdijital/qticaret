import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  LISTING_ALL_TITLE_MAX,
  LISTING_COUNT_WORD_MAX,
  LISTING_CRUMBS_PLACES,
  listingPageOf,
} from "@qticaret/types"
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

/** The all-products title as typed (none before the setting). */
const typedTitle = (saved: Partial<ListingPageSettings> | undefined): string =>
  saved?.all_title ?? ""

interface ListingPageGroupProps {
  theme: ThemeSettings
  /** Opens the group now (the settings search's pick); null: none. */
  reveal: number | null
  onChange: (theme: ThemeSettings) => void
}

/**
 * "Liste sayfası": how the shop's listing pages (all products, a
 * category, a brand) lay out their products, shop-wide: a grid or one to
 * a row by default, whether the shopper may switch, whether the trail
 * ends with the page itself and where it stands (above the title, on its
 * line, or not drawn), the word after the count ("24 tur") and the
 * all-products page's title ("Tüm turlar").
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
  const place = THEME_FIELD["listing_page.crumbs_place"]
  const word = THEME_FIELD["listing_page.count_word"]
  const all = THEME_FIELD["listing_page.all_title"]
  // As typed (its spaces too); the saved one is trimmed
  const rawWord = typedWord(theme.listing_page)
  const rawTitle = typedTitle(theme.listing_page)
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
      <ChoiceSelect
        id={place.target}
        label={t(place.label)}
        value={page.crumbs_place}
        options={LISTING_CRUMBS_PLACES}
        onChange={(value) => {
          set({ crumbs_place: value })
        }}
        render={(option) => t(`${P}.crumbs_place.steps.${option}`)}
        hint={t(`${P}.crumbs_place.hint`)}
      />
      <Field label={t(word.label)} htmlFor={word.target} hint={t(`${P}.count_word.hint`)}>
        <Input
          id={word.target}
          value={rawWord}
          placeholder={t(`${P}.count_word.placeholder`)}
          maxLength={LISTING_COUNT_WORD_MAX}
          autoComplete="off"
          onChange={(event) => {
            const text = event.target.value
            set({ count_word: text.trim() === "" ? null : text })
          }}
        />
      </Field>
      <Field label={t(all.label)} htmlFor={all.target} hint={t(`${P}.all_title.hint`)}>
        <Input
          id={all.target}
          value={rawTitle}
          placeholder={t(`${P}.all_title.placeholder`)}
          maxLength={LISTING_ALL_TITLE_MAX}
          autoComplete="off"
          onChange={(event) => {
            const text = event.target.value
            set({ all_title: text.trim() === "" ? null : text })
          }}
        />
      </Field>
    </PanelGroup>
  )
}
