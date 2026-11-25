import { z } from "@medusajs/framework/zod"
import { isReservedParam } from "../../../lib/seo/facets"
import { isPlainObject } from "./define"

/**
 * The search box's fields (adr/0077 §1): one theme setting for the whole
 * shop, a group of the theme section (`search_form`), drafted and
 * published with the design. Mirrors `@qticaret/types`' `search-form.ts`
 * (a unit test keeps them equal). The dates and the party show only while
 * the shop sells dated products, whatever these say.
 */
export const SEARCH_FORM_CATEGORY_STYLES = ["select", "tabs"] as const

export interface SearchFormSettings {
  /** The filterable choice attribute behind the "where" field; null: none. */
  attribute_key: string | null
  show_category: boolean
  show_dates: boolean
  show_people: boolean
  flexible_month: boolean
  date_words: boolean
  boxed_fields: boolean
  category_style: (typeof SEARCH_FORM_CATEGORY_STYLES)[number]
  /** The words field's hint before a search; null: the storefront's own. */
  placeholder: string | null
}

/** Every field on, no attribute named, categories in a drop-down. */
export const SEARCH_FORM_DEFAULTS: Readonly<SearchFormSettings> = {
  attribute_key: null,
  show_category: true,
  show_dates: true,
  show_people: true,
  flexible_month: true,
  date_words: false,
  boxed_fields: false,
  category_style: "select",
  placeholder: null,
}

// An attribute key as the listing reads one in its address (adr/0013)
const ATTRIBUTE_KEY = /^[a-z][a-z0-9_]{0,63}$/

/** The longest hint the shop may write (`@qticaret/types`' `SEARCH_FORM_PLACEHOLDER_MAX`). */
export const SEARCH_FORM_PLACEHOLDER_MAX = 60

/**
 * The group's schema, every field present. A key a listing never reads in
 * its address (a reserved name: `kategori`, `tarih`, `marka`…) is refused:
 * the box could never ask it.
 */
export const searchFormSchema = z
  .object({
    attribute_key: z
      .string()
      .regex(ATTRIBUTE_KEY, { message: "platform_settings.search_form_key_invalid" })
      .refine((key) => !isReservedParam(key), {
        message: "platform_settings.search_form_key_invalid",
      })
      .nullable(),
    show_category: z.boolean(),
    show_dates: z.boolean(),
    show_people: z.boolean(),
    flexible_month: z.boolean(),
    date_words: z.boolean(),
    boxed_fields: z.boolean(),
    category_style: z.enum(SEARCH_FORM_CATEGORY_STYLES),
    // Trimmed, never empty: no hint is null (the storefront's own words)
    placeholder: z.string().trim().min(1).max(SEARCH_FORM_PLACEHOLDER_MAX).nullable(),
  })
  .strict()

/**
 * Theme settings with the group at its defaults where it or a field of it
 * is missing: a design's theme, a preset or a panel save written before
 * adr/0077 reads as the defaults. A value off a list is kept, for the
 * schema to refuse.
 */
export function withSearchFormDefaults(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value
  }
  const group = value["search_form"]
  if (group !== undefined && !isPlainObject(group)) {
    return value
  }
  return { ...value, search_form: { ...SEARCH_FORM_DEFAULTS, ...group } }
}
