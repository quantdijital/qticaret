/** The places the shop's catalog is sent (F10.8, adr/0038 §3); each has its formatter. */
export const FEED_TARGETS = ["google", "meta", "cimri", "akakce"] as const
export type FeedTarget = (typeof FEED_TARGETS)[number]
