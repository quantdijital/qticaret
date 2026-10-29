import { akakceFeed } from "./akakce"
import { cimriFeed } from "./cimri"
import { googleFeed } from "./google"
import { metaFeed } from "./meta"
import type { FeedFormatter } from "./items"

export { excludedBy, feedItemsOf, feedPrice, feedText, shippingCost } from "./items"
export type { FeedFormatter, FeedItem, FeedPlace, FeedShop } from "./items"
export { GOOGLE_NAMESPACE } from "./google"
export { googleFeedProblems } from "./validate"
/** Google's formatter: what it lists is what Merchant API receives too (F10 M13). */
export { googleFeed as googleFeedFormatter } from "./google"

/**
 * Every feed the shop publishes (adr/0038 §3): Google and Meta by their
 * specifications, Cimri and Akakçe in the shape the shop's earlier store
 * sent them. A new target is a new formatter.
 */
export const FEED_FORMATTERS: readonly FeedFormatter[] = [
  googleFeed,
  metaFeed,
  cimriFeed,
  akakceFeed,
]

export { FEED_TARGETS } from "./targets"
export type { FeedTarget } from "./targets"

export const feedFormatterOf = (target: string): FeedFormatter | undefined =>
  FEED_FORMATTERS.find((formatter) => formatter.target === target)
