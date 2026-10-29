/**
 * Where an order's shopper came from (F11.2, adr/0039 §2): the storefront
 * keeps the first landing of the cart, without anything of the person:
 * the campaign's `utm_*` words, the referring site's host, and whether
 * an ad click id was there. Classed the way search and ad tools report it.
 */

export const TRAFFIC_SOURCES = [
  "organic_search",
  "paid_search",
  "social",
  "paid_social",
  "email",
  "referral",
  "direct",
] as const
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number]

export interface Landing {
  utm_source?: string | null | undefined
  utm_medium?: string | null | undefined
  utm_campaign?: string | null | undefined
  /** The referring page's host only (`www.google.com`). */
  referrer_host?: string | null | undefined
  /** A Google Ads click id (`gclid`) was on the landing address. */
  gclid?: boolean | undefined
  /** A Meta click id (`fbclid`) was on the landing address. */
  fbclid?: boolean | undefined
}

const SEARCH = /(^|\.)(google|bing|yandex|yahoo|duckduckgo|ecosia|baidu|qwant|startpage)\.[a-z.]+$/
const SOCIAL =
  /(^|\.)(facebook|instagram|twitter|x|t|linkedin|lnkd|pinterest|tiktok|youtube|reddit|whatsapp|telegram|threads)\.[a-z.]+$|^t\.co$/
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsearch|paid_search|sem|cpm|display|ads?)$/
const PAID_SOCIAL_MEDIUM = /^(paid_?social|social_?paid|cpm_?social)$/
const SOCIAL_MEDIUM = /^(social|social_?network|social_?media|sm)$/
const EMAIL_MEDIUM = /^(e-?mail|newsletter|eposta|e-?posta)$/
const SOCIAL_SOURCE =
  /^(facebook|fb|instagram|ig|meta|tiktok|twitter|x|linkedin|pinterest|youtube)$/

const word = (value: string | null | undefined) => (value ?? "").trim().toLowerCase()

/**
 * The class of a landing; `ownHost` (the storefront's) refers to itself,
 * which is no referral.
 */
export function classifyLanding(landing: Landing, ownHost?: string | null): TrafficSource {
  const medium = word(landing.utm_medium)
  const source = word(landing.utm_source)
  const host = word(landing.referrer_host).replace(/^www\./, "")
  if (landing.gclid) {
    return "paid_search"
  }
  if (PAID_SOCIAL_MEDIUM.test(medium) || (PAID_MEDIUM.test(medium) && SOCIAL_SOURCE.test(source))) {
    return "paid_social"
  }
  if (PAID_MEDIUM.test(medium)) {
    return "paid_search"
  }
  if (EMAIL_MEDIUM.test(medium)) {
    return "email"
  }
  if (SOCIAL_MEDIUM.test(medium) || landing.fbclid || SOCIAL_SOURCE.test(source)) {
    return "social"
  }
  if (medium === "organic" || SEARCH.test(host)) {
    return "organic_search"
  }
  if (SOCIAL.test(host)) {
    return "social"
  }
  if (medium === "referral" || (host && host !== word(ownHost).replace(/^www\./, ""))) {
    return "referral"
  }
  return "direct"
}
