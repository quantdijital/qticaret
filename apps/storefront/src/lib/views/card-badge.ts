import type { CardBadgeView, Translate } from "@qticaret/ui"
import type { StoreCardFacts } from "@qticaret/types"

/**
 * A card's badge from its facts (the owner, 2026-11-24): the product's
 * own line as the shop wrote it, "Çok satan" and "Yeni" in the
 * storefront's words. None without one, or from a backend before it.
 */
export function cardBadge(badge: StoreCardFacts["badge"], t: Translate): CardBadgeView | null {
  if (!badge) {
    return null
  }
  switch (badge.kind) {
    case "manual": {
      const text = typeof badge.text === "string" ? badge.text.trim() : ""
      return text ? { text, kind: "manual" } : null
    }
    case "best_seller":
      return { text: t("product.badge_best_seller"), kind: "best_seller" }
    case "new":
      return { text: t("product.badge_new"), kind: "new" }
    default:
      // A kind this build does not know: no badge rather than a wrong one
      return null
  }
}
