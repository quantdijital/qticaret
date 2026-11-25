import type { FeatureState } from "@/features/settings/api/features"

/**
 * Settings > Features in groups by area. The flag keys are stable (adr/0012,
 * the backend's `FEATURES`), so the panel maps them; `feature-groups.spec.ts`
 * fails when the backend registers a flag no group holds. The groups are
 * ordered for the page's two columns: the first three on the left, the rest
 * on the right, each column about as long as the other.
 */
export const FEATURE_GROUPS = [
  {
    id: "catalog",
    keys: [
      "catalog.non_physical",
      "catalog.booking",
      "catalog.addons",
      "catalog.collections",
      "catalog.product_videos",
    ],
  },
  { id: "customers", keys: ["customers.wholesale", "marketing.campaigns", "marketing.popups"] },
  { id: "seo", keys: ["seo.publish_gate", "seo.indexnow"] },
  {
    id: "sales",
    keys: [
      "payments.cash_on_delivery",
      "orders.payment_links",
      "promotions.gift_cards",
      "stock.preorder",
    ],
  },
  { id: "restricted", keys: ["catalog.restricted", "compliance.age_verification"] },
  {
    id: "ai",
    keys: [
      "ai.own_keys",
      "ai.platform_credits",
      "ai.reviews",
      "ai.storefront_search",
      "ai.assistant",
    ],
  },
] as const

export type FeatureGroupId = (typeof FEATURE_GROUPS)[number]["id"] | "other"

/** How many groups the left column takes; the rest go right. */
export const LEFT_GROUPS = 3

/** A flag that works only while another is on (the catalog save checks both, adr/0076). */
export const FEATURE_REQUIRES: Readonly<Record<string, string>> = {
  "catalog.booking": "catalog.non_physical",
}

const GROUP_OF = new Map<string, FeatureGroupId>(
  FEATURE_GROUPS.flatMap((group) => group.keys.map((key) => [key, group.id] as const))
)

/** The group a flag shows in; one the panel does not know yet goes to "other". */
export const groupOf = (key: string): FeatureGroupId => GROUP_OF.get(key) ?? "other"

export interface FeatureGroup {
  id: FeatureGroupId
  features: FeatureState[]
}

/** The flags in their groups, in the groups' order; empty groups left out. */
export function groupFeatures(features: readonly FeatureState[]): FeatureGroup[] {
  const order: FeatureGroupId[] = [...FEATURE_GROUPS.map((group) => group.id), "other"]
  const rank = (key: string) => {
    const group = FEATURE_GROUPS.find((entry) => entry.id === groupOf(key))
    return group ? (group.keys as readonly string[]).indexOf(key) : 0
  }
  return order
    .map((id) => ({
      id,
      features: features
        .filter((feature) => groupOf(feature.key) === id)
        .sort((a, b) => rank(a.key) - rank(b.key)),
    }))
    .filter((group) => group.features.length > 0)
}

/** Lower-cased for a Turkish search ("İ" and "I" fold as Turkish does). */
const fold = (text: string) => text.toLocaleLowerCase("tr")

/** Whether a flag's words hold every word of the search. */
export function matchesSearch(words: readonly string[], search: string): boolean {
  const terms = fold(search).split(/\s+/).filter(Boolean)
  const haystack = fold(words.join(" "))
  return terms.every((term) => haystack.includes(term))
}
