import type { AnySection } from "@/features/storefront/api/layout"

/**
 * Why a section the frame looked for and did not find is not drawn, as far
 * as the editor can tell; each is a key under `storefront.editor.preview.missing`.
 * - `incomplete`: it has fields still to fill, so the draft is not saved yet.
 * - `unsaved`: another part has, so nothing new is saved yet.
 * - `empty`: saved, but what it shows comes from the shop (reviews, posts,
 *   products, contact details) and there is none yet; the storefront draws
 *   such a section only with something in it.
 * - `timeout`: none of these; a real miss.
 */
export type LostReason = "incomplete" | "unsaved" | "empty" | "timeout"

/**
 * Sections the storefront leaves out when the shop has nothing for them
 * (apps/storefront `views/sections.ts`): their content is the shop's, not
 * the form's.
 */
const SHOP_FILLED: ReadonlySet<AnySection["type"]> = new Set([
  "categories",
  "products",
  "related_products",
  // adr/0078: drawn only for a product with steps
  "program",
  "brands",
  "posts",
  "reviews",
  "trust_badges",
  "featured_product",
  // Its strips whose record is gone are left out; with none left it is not drawn
  "strip_gallery",
  "help",
  "newsletter",
])

/**
 * Like Shopify's editor, a section with nothing to show yet is not an
 * error: the notice says what would bring it, and only a section that
 * should be drawn is reported as not found.
 */
export function lostReason(
  section: AnySection,
  { own, blocked }: { own: boolean; blocked: boolean }
): LostReason {
  if (own) {
    return "incomplete"
  }
  if (blocked) {
    return "unsaved"
  }
  return SHOP_FILLED.has(section.type) ? "empty" : "timeout"
}
