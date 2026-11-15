import type { QuickViewView } from "@qticaret/ui"
import type { StoreProduct } from "@qticaret/types"
import { productAddonsOrNone } from "@/lib/cart/addons"
import { t } from "@/lib/i18n"
import { isNotFound, isStoreApiError } from "@/lib/store-api/errors"
import { cardFacts } from "@/lib/store-api/extras"
import { productTexts } from "@/lib/store-api/product-description"
import { pathsOf, priceDisplays, productById, storefrontSettings } from "@/lib/store-api/requests"
import { cardRating } from "@/lib/views/card-extras"
import { swatchLookup } from "@/lib/views/color"
import { currentShared } from "@/lib/views/layout"
import { variantIdsOf } from "@/lib/views/product"
import { quickViewIdOf, quickViewOf } from "@/lib/views/quick-view"
import { currentTheme } from "@/lib/views/theme-settings"

// Every answer is the shopper's: never a cached page
export const dynamic = "force-dynamic"

// The prices are the shopper's own (a signed-in customer's group): kept by nobody on the way;
// the dialog's words are its product page's, never a page of their own to index (docs/13)
const HEADERS = { "cache-control": "private, no-store", "x-robots-tag": "noindex" }

const notFound = () =>
  Response.json({ message: "quick_view.not_found" }, { status: 404, headers: HEADERS })

/**
 * Whether the product asks for more than the dialog sends (a variant and a quantity): a gift
 * card's recipient, as the product page asks it, or a required add-on; the page then, not the
 * button. Add-ons are asked only while the shop has them on (kept a minute, as the page's).
 */
async function asksMoreThanDialog(product: StoreProduct): Promise<boolean> {
  if (product.product_extension?.is_gift_card) {
    // A gift card takes no add-ons (the page's own rule)
    return (await storefrontSettings()).features?.gift_cards === true
  }
  return (await productAddonsOrNone(product.id)).some((addon) => addon.required)
}

/** The product as the dialog shows it; null when it has no live page (not sold here). */
async function quickViewFor(id: string): Promise<QuickViewView | null> {
  // The product first: an id nobody sells is one call and a 404, and never asks for a path
  // (the shared path cache would keep an empty entry for every id guessed)
  const product = await productById(id)
  const [paths, texts, settings, shared, facts, needsPage] = await Promise.all([
    pathsOf("product", [id]),
    productTexts(id),
    currentTheme(),
    currentShared(),
    cardFacts([id]),
    asksMoreThanDialog(product),
  ])
  const path = paths[id]
  if (!path) {
    return null
  }
  const card = settings.product_card
  const displays = await priceDisplays(variantIdsOf([product]))
  return quickViewOf({
    product,
    path,
    displays,
    summaryHtml: texts.summary,
    rating: cardRating(facts[id]?.rating, t),
    shown: {
      brand: card.show_brand,
      rating: card.quick_view_rating,
      summary: card.quick_view_summary,
      quantity: card.quick_view_quantity,
    },
    needsPage,
    t,
    swatchOf: swatchLookup(shared.color_swatches),
  })
}

/**
 * `GET /api/quick-view?id=` (adr/0049 Ek 2026-11-15): a card's quick view
 * dialog, asked when it opens, from the storefront's server only (adr/0046
 * §5: the browser never calls the backend). The product page's own reading
 * of the product (its photos, options, variants priced now), cut to the
 * dialog. Not a product id is a 400; a product not sold here a 404 (the
 * dialog then offers its page; so is every id when the shop has the quick
 * view off); a failure a 502 (the backend's 429 passed on).
 */
export async function GET(request: Request): Promise<Response> {
  const id = quickViewIdOf(new URL(request.url).searchParams)
  if (id === null) {
    return Response.json({ message: "quick_view.invalid" }, { status: 400, headers: HEADERS })
  }
  try {
    // The shop turned it off: no dialog to fill, so not a call to the backend either
    if (!(await currentTheme()).product_card.quick_view) {
      return notFound()
    }
    const view = await quickViewFor(id)
    return view ? Response.json(view, { headers: HEADERS }) : notFound()
  } catch (error) {
    if (isNotFound(error)) {
      return notFound()
    }
    const status = isStoreApiError(error) && error.status === 429 ? 429 : 502
    return Response.json({ message: "quick_view.failed" }, { status, headers: HEADERS })
  }
}
