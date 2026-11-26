import { isSelectType } from "@/features/attributes/types"
import type { AttributeTemplate } from "@/features/attributes/types"
import { SEARCH_FORM_CATEGORY_STYLES } from "@/features/storefront/api/theme"
import type { ThemeChoices } from "@/features/storefront/api/theme"
import type { CardVariantsInUse, FieldMeta, ShopFlags } from "./theme-registry"
import { DATED_FLAG } from "./theme-registry-tour"

/**
 * The search box's fields (adr/0077 §1) as the theme panel and its search
 * know them, kept beside the registry (`theme-registry.ts`) that spreads
 * them in. The dates and the party only while the shop sells dated
 * products (`catalog.booking`); the categories' look only while they are
 * shown. "arama", "kutu" find every one.
 */

const C = "storefront.editor.theme"
const S = `${C}.searchForm`
const KEYWORDS = `${S}.words`

const field = (
  name:
    | "attribute_key"
    | "placeholder"
    | "show_category"
    | "show_dates"
    | "show_people"
    | "flexible_month"
    | "date_words"
    | "boxed_fields"
    | "category_style",
  shown?: (theme: ThemeChoices, variants: CardVariantsInUse, flags: ShopFlags) => boolean
): FieldMeta => ({
  group: "searchForm",
  label: `${S}.${name}.label`,
  keywords: KEYWORDS,
  ...(name === "category_style"
    ? { options: SEARCH_FORM_CATEGORY_STYLES.map((style) => `${S}.category_style.steps.${style}`) }
    : {}),
  ...(shown ? { shown } : {}),
})

const dated = (_theme: ThemeChoices, _variants: CardVariantsInUse, flags: ShopFlags) =>
  flags.has(DATED_FLAG)

const datesShown = (theme: ThemeChoices, variants: CardVariantsInUse, flags: ShopFlags) =>
  dated(theme, variants, flags) && theme.search_form.show_dates

export const SEARCH_FORM_META = {
  "search_form.attribute_key": field("attribute_key"),
  "search_form.placeholder": field("placeholder"),
  "search_form.show_category": field("show_category"),
  "search_form.category_style": field("category_style", (theme) => theme.search_form.show_category),
  "search_form.show_dates": field("show_dates", dated),
  "search_form.show_people": field("show_people", dated),
  // The dates' own two, only while the dates are shown
  "search_form.flexible_month": field("flexible_month", datesShown),
  "search_form.date_words": field("date_words", datesShown),
  "search_form.boxed_fields": field("boxed_fields"),
} satisfies Record<string, FieldMeta>

/** Names a listing's address keeps for itself: never an attribute's filter there (adr/0077 §2). */
const RESERVED = new Set([
  "marka",
  "stok",
  "fiyat",
  "sirala",
  "sayfa",
  "kategori",
  "tarih",
  "ay",
  "kisi",
  "q",
])

/**
 * The attributes a "where" field can use: filterable, shown to shoppers,
 * one choice or several, never a reserved name; each once, in the
 * templates' order.
 */
export function whereAttributes(templates: readonly AttributeTemplate[]) {
  const found = new Map<string, string>()
  for (const definition of templates.flatMap((template) => template.definitions)) {
    if (
      definition.is_filterable &&
      definition.is_public !== false &&
      isSelectType(definition.type) &&
      !RESERVED.has(definition.key) &&
      !found.has(definition.key)
    ) {
      found.set(definition.key, definition.label)
    }
  }
  return found
}
