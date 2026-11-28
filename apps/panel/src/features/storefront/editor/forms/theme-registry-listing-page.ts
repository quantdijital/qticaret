import { LISTING_CRUMBS_PLACES } from "@qticaret/types"
import { LISTING_VIEWS } from "@/features/storefront/api/theme"
import type { FieldMeta } from "./theme-registry"

/**
 * A listing page's layout (`listing_page`) as the theme panel and its
 * search know it, kept beside the registry (`theme-registry.ts`) that
 * spreads it in: the products as a grid or a list, the shopper's switch,
 * the trail's last crumb and its place (or none), the count's word.
 * "liste", "ızgara", "görünüm" find every one.
 */

const C = "storefront.editor.theme"
const P = `${C}.listingPage`

const field = (
  name:
    | "default_view"
    | "view_switch"
    | "breadcrumb_current"
    | "crumbs_place"
    | "count_word"
    | "all_title"
): FieldMeta => ({
  group: "listingPage",
  label: `${P}.${name}.label`,
  keywords: `${P}.words`,
  ...(name === "default_view"
    ? { options: LISTING_VIEWS.map((view) => `${P}.default_view.steps.${view}`) }
    : {}),
  ...(name === "crumbs_place"
    ? { options: LISTING_CRUMBS_PLACES.map((place) => `${P}.crumbs_place.steps.${place}`) }
    : {}),
})

export const LISTING_PAGE_META = {
  "listing_page.default_view": field("default_view"),
  "listing_page.view_switch": field("view_switch"),
  "listing_page.breadcrumb_current": field("breadcrumb_current"),
  "listing_page.crumbs_place": field("crumbs_place"),
  "listing_page.count_word": field("count_word"),
  "listing_page.all_title": field("all_title"),
} satisfies Record<string, FieldMeta>
