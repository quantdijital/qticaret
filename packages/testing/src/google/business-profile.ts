import type { ServerResponse } from "node:http"
import type { FakeBusinessProfileData, FakeBusinessReview } from "./business-data"

/**
 * Business Profile's three reads as Google answers them (adr/0058): the
 * accounts (`GET /v1/accounts`, 20 a page), an account's locations
 * (`GET /v1/{account}/locations`, `readMask` required, 100 a page) and a
 * location's reviews with its average and count (`GET /v4/{account}/
 * {location}/reviews`, 50 a page). Each needs `business.manage`; a project
 * Google has not approved gets 429 `RESOURCE_EXHAUSTED` (its 0 QPM).
 */

export const BUSINESS_MANAGE = "https://www.googleapis.com/auth/business.manage"

export interface FakeBusinessProfile extends FakeBusinessProfileData {
  /** Not approved yet: every call answers 429 (0 queries a minute). */
  approved: boolean
  /** Review pages served, to tell a sync read them all. */
  reviewPages: { count: number }
}

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as const

/** A page of a list, its token the next item's index (Google's tokens are opaque). */
function pageOf<T>(
  items: readonly T[],
  url: URL,
  max: number,
  fallback: number
): { items: T[]; next?: string } {
  const asked = Number(url.searchParams.get("pageSize") ?? fallback)
  const size = Math.min(Number.isInteger(asked) && asked > 0 ? asked : fallback, max)
  const token = url.searchParams.get("pageToken")
  const start = token ? Number(Buffer.from(token, "base64url").toString("utf8")) : 0
  const page = items.slice(start, start + size)
  const after = start + size
  return after < items.length
    ? { items: page, next: Buffer.from(String(after)).toString("base64url") }
    : { items: page }
}

/** Google's own average (to one decimal, as it gives it) and count of the reviews. */
function figures(reviews: readonly FakeBusinessReview[]): {
  averageRating?: number
  totalReviewCount: number
} {
  if (reviews.length === 0) {
    return { totalReviewCount: 0 }
  }
  const sum = reviews.reduce((total, review) => total + STARS[review.starRating], 0)
  return {
    averageRating: Math.round((sum / reviews.length) * 10) / 10,
    totalReviewCount: reviews.length,
  }
}

/**
 * Answers a Business Profile call; false when the path is not one of them.
 * `scope`: what the bearer token was granted.
 */
export function answerBusinessProfile(
  fake: FakeBusinessProfile,
  method: string,
  url: URL,
  scope: string,
  json: (res: ServerResponse, status: number, body: unknown) => void,
  res: ServerResponse
): boolean {
  const reviews = /^\/v4\/(accounts\/[^/]+)\/(locations\/[^/]+)\/reviews$/.exec(url.pathname)
  const locations = /^\/v1\/(accounts\/[^/]+)\/locations$/.exec(url.pathname)
  const accounts = url.pathname === "/v1/accounts"
  if (method !== "GET" || (!reviews && !locations && !accounts)) {
    return false
  }
  const refuse = (status: number, word: string) => {
    json(res, status, { error: { code: status, status: word, message: word } })
  }
  if (!scope.split(" ").includes(BUSINESS_MANAGE)) {
    refuse(403, "PERMISSION_DENIED")
    return true
  }
  if (!fake.approved) {
    refuse(429, "RESOURCE_EXHAUSTED")
    return true
  }
  if (accounts) {
    const page = pageOf(fake.accounts, url, 20, 20)
    json(res, 200, { accounts: page.items, ...(page.next ? { nextPageToken: page.next } : {}) })
    return true
  }
  if (locations?.[1]) {
    if (!url.searchParams.get("readMask")) {
      refuse(400, "INVALID_ARGUMENT")
      return true
    }
    const known = fake.locations.get(locations[1])
    if (!known) {
      refuse(403, "PERMISSION_DENIED")
      return true
    }
    const page = pageOf(known, url, 100, 10)
    json(res, 200, { locations: page.items, ...(page.next ? { nextPageToken: page.next } : {}) })
    return true
  }
  const [, account = "", location = ""] = reviews ?? []
  const reached = fake.locations.get(account)?.some((each) => each.name === location)
  const all = fake.reviews.get(location)
  if (!reached || !all) {
    refuse(404, "NOT_FOUND")
    return true
  }
  fake.reviewPages.count += 1
  const page = pageOf(all, url, 50, 50)
  json(res, 200, {
    reviews: page.items.map((review) => ({
      ...review,
      name: `${account}/${location}/reviews/${review.reviewId}`,
    })),
    ...figures(all),
    ...(page.next ? { nextPageToken: page.next } : {}),
  })
  return true
}

const COLORS = ["#5C6BC0", "#26A69A", "#EF6C00", "#8D6E63", "#7E57C2", "#00897B", "#C0CA33"]

/** A reviewer's photo as Google draws one without a picture: the first letter on a colour. */
export function letterPhoto(id: string, name: string): string {
  const color = COLORS[Buffer.from(id).reduce((sum, byte) => sum + byte, 0) % COLORS.length]
  const first = name.trim()[0] ?? ""
  const letter = /^\p{L}$/u.test(first) ? first.toLocaleUpperCase("tr-TR") : "G"
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">`,
    `<rect width="120" height="120" fill="${color ?? "#5C6BC0"}"/>`,
    `<text x="60" y="78" font-family="Arial, sans-serif" font-size="56" fill="#fff" text-anchor="middle">${letter}</text>`,
    `</svg>`,
  ].join("")
}
