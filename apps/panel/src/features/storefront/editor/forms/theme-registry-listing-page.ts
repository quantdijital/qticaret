import { LISTING_VIEWS } from "@/features/storefront/api/theme"
import type { FieldMeta } from "./theme-registry"

/**
 * A listing page's layout (`listing_page`) as the theme panel and its
 * search know it, kept beside the registry (`theme-registry.ts`) that
 * spreads it in: the products as a grid or a list, the shopper's switch,
 * the trail's last crumb. "liste", "ızgara", "görünüm" find every one.
 */

const C = "storefront.editor.theme"
const P = `${C}.listingPage`

const field = (name: "default_view" | "view_switch" | "breadcrumb_current"): FieldMeta => ({
  group: "listingPage",
  label: `${P}.${name}.label`,
  keywords: `${P}.words`,
  ...(name === "default_view"
    ? { options: LISTING_VIEWS.map((view) => `${P}.default_view.steps.${view}`) }
    : {}),
})

export const LISTING_PAGE_META = {
  "listing_page.default_view": field("default_view"),
  "listing_page.view_switch": field("view_switch"),
  "listing_page.breadcrumb_current": field("breadcrumb_current"),
} satisfies Record<string, FieldMeta>
