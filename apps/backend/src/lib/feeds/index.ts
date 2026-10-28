import { googleFeed } from "./google"
import { metaFeed } from "./meta"
import type { FeedFormatter } from "./items"

export { feedItemsOf, feedPrice, feedText } from "./items"
export type { FeedFormatter, FeedItem, FeedShop } from "./items"
export { GOOGLE_NAMESPACE } from "./google"
export { googleFeedProblems } from "./validate"

/**
 * Every feed the shop publishes (adr/0038 §3). Akakçe and Cimri join as
 * formatters of their own once their current XML formats are in hand
 * (from the shop's seller panel; neither publishes one).
 */
export const FEED_FORMATTERS: readonly FeedFormatter[] = [googleFeed, metaFeed]

export type FeedTarget = "google" | "meta"

export const feedFormatterOf = (target: string): FeedFormatter | undefined =>
  FEED_FORMATTERS.find((formatter) => formatter.target === target)
