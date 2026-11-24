import "server-only"
import { cache } from "react"
import { searchFormOf } from "@qticaret/types/search-form"
import type { SearchFormView, Translate } from "@qticaret/ui"
import { listingPage } from "@/lib/store-api/listings"
import { allCategories, storefrontSettings } from "@/lib/store-api/requests"
import { searchFormView } from "./search-form"
import type { SearchFormSource, SearchFormValues } from "./search-form"
import { currentTheme } from "./theme-settings"

// The shop's zone, where "today" is read (the backend's `SHOP_TIMEZONE`)
const SHOP_ZONE = "Europe/Istanbul"

/** Today in the shop's zone, `YYYY-MM-DD` (en-CA writes dates so). */
export const shopToday = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

/**
 * A filterable attribute's name and the values the shop's live catalogue
 * holds, from the whole catalogue's filters (`/magaza`'s, one read per
 * request); null when it has none or the read fails.
 */
const whereOf = cache(async (key: string): Promise<SearchFormSource["where"]> => {
  try {
    const answer = await listingPage("all", "all", "")
    const attribute = answer.facets.attributes.find((each) => each.key === key)
    return attribute
      ? {
          label: attribute.label,
          options: attribute.values.map(({ value, label }) => ({ value, label })),
        }
      : null
  } catch {
    return null
  }
})

/** The shop's top categories in its order (the tree's first level). */
const topCategories = cache(async (): Promise<SearchFormSource["categories"]> => {
  const categories = await allCategories().catch(() => [])
  return categories
    .filter((category) => category.parent_category_id === null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map(({ handle, name }) => ({ handle, name }))
})

/**
 * The shop's search box for this request (adr/0077 §1), its values those
 * given: its theme setting (a preview's draft on its address), whether it
 * sells dated products, its categories and its "where" values. Only what
 * a field needs is read.
 */
export async function currentSearchForm(
  values: SearchFormValues,
  t: Translate
): Promise<SearchFormView> {
  const [theme, answer] = await Promise.all([currentTheme(), storefrontSettings()])
  const settings = searchFormOf(theme.search_form)
  const [categories, where] = await Promise.all([
    settings.show_category ? topCategories() : Promise.resolve([]),
    settings.attribute_key ? whereOf(settings.attribute_key) : Promise.resolve(null),
  ])
  const source: SearchFormSource = {
    settings,
    booking: answer.features?.booking === true,
    categories,
    where,
    today: shopToday(),
  }
  return searchFormView(source, values, t)
}
