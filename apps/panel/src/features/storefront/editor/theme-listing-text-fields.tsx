import { useTranslation } from "react-i18next"
import { listingTextOf } from "@qticaret/types"
import type { ListingTextSettings } from "@qticaret/types"
import {
  LISTING_TEXT_ALIGNS,
  LISTING_TEXT_SIZES,
  LISTING_TEXT_WIDTHS,
} from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { PanelGroup } from "./panel-header"
import { ChoiceSelect, SwitchRow } from "./theme-fields"
import { THEME_FIELD, THEME_GROUP_TITLES } from "./forms/theme-registry"

const C = "storefront.editor.theme"
const L = `${C}.listingText`

type Choice = "size" | "align" | "width"

const LISTS: { [K in Choice]: readonly ListingTextSettings[K][] } = {
  size: LISTING_TEXT_SIZES,
  align: LISTING_TEXT_ALIGNS,
  width: LISTING_TEXT_WIDTHS,
}

interface ListingTextGroupProps {
  theme: ThemeSettings
  /** Opens the group now (the settings search's pick); null: none. */
  reveal: number | null
  onChange: (theme: ThemeSettings) => void
}

/**
 * "Liste metni" (adr/0075 §6): how a category, brand or collection page's
 * text looks at its foot, shop-wide: its size, alignment, measure and
 * whether a long one folds behind "Devamını oku". The face is the body
 * face. A draft from before the group reads at its defaults.
 */
export function ListingTextGroup({ theme, reveal, onChange }: ListingTextGroupProps) {
  const { t } = useTranslation()
  const text = listingTextOf(theme.listing_text)
  const set = (patch: Partial<ListingTextSettings>) => {
    onChange({ ...theme, listing_text: { ...text, ...patch } })
  }
  const choice = (name: Choice) => {
    const field = THEME_FIELD[`listing_text.${name}`]
    const list: readonly string[] = LISTS[name]
    return (
      <ChoiceSelect
        id={field.target}
        label={t(field.label)}
        value={text[name]}
        options={list}
        onChange={(value) => {
          set({ [name]: value })
        }}
        render={(option) => t(field.options[list.indexOf(option)] ?? option)}
        hint={t(`${L}.${name}.hint`)}
      />
    )
  }
  return (
    <PanelGroup
      name="listingText"
      title={t(THEME_GROUP_TITLES.listingText)}
      hint={t(`${C}.listingTextHint`)}
      reveal={reveal}
    >
      <div className={cn("grid gap-4", "@min-[21rem]:grid-cols-2")}>
        {choice("size")}
        {choice("align")}
        {choice("width")}
      </div>
      <SwitchRow
        id={THEME_FIELD["listing_text.collapse"].target}
        label={t(THEME_FIELD["listing_text.collapse"].label)}
        hint={t(`${L}.collapse.hint`)}
        checked={text.collapse}
        onChange={(collapse) => {
          set({ collapse })
        }}
      />
    </PanelGroup>
  )
}
