import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../clients"
import type { HttpClient, HttpClientOptions } from "../clients"
import { parseEnv } from "../env"
import { GOOGLE_PROVIDER, googleHosts } from "./oauth"
import { reviewOf } from "./business-review"
import type { GoogleReviewInput } from "./business-review"

/**
 * Google Business Profile for the shop's Google reviews (adr/0058),
 * checked against its references: the accounts the connected Google
 * account manages (Account Management API v1), each one's locations
 * (Business Information API v1, `readMask` required) and a location's
 * reviews with its average and count (Google My Business API v4, 50 a
 * page at most). A refusal carries Google's `error.status`.
 */

const apiError = (body: unknown): string | undefined => {
  const status = (body as { error?: { status?: unknown } } | null)?.error?.status
  return typeof status === "string" ? status : undefined
}

// Names as path segments that cannot be bent
const ACCOUNT = /^accounts\/[\w-]{1,64}$/
const LOCATION = /^locations\/[\w-]{1,64}$/

function checked(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) {
    throw new Error(`google: not a ${what}`)
  }
  return value
}

/** Whether a name is a Business Profile account's and a location's, as the API writes them. */
export const isAccountName = (value: string): boolean => ACCOUNT.test(value)
export const isLocationName = (value: string): boolean => LOCATION.test(value)

// Pages read at most: 20 accounts and 100 locations a page, 50 reviews a page
const MAX_ACCOUNT_PAGES = 5
const MAX_LOCATION_PAGES = 5
export const REVIEWS_PAGE_SIZE = 50

const Accounts = z.looseObject({
  accounts: z
    .array(z.looseObject({ name: z.string(), accountName: z.string().optional() }))
    .optional(),
  nextPageToken: z.string().optional(),
})

const Locations = z.looseObject({
  locations: z
    .array(
      z.looseObject({
        name: z.string(),
        title: z.string().optional(),
        storefrontAddress: z
          .looseObject({
            addressLines: z.array(z.string()).optional(),
            locality: z.string().optional(),
            administrativeArea: z.string().optional(),
          })
          .optional(),
        metadata: z
          .looseObject({ mapsUri: z.string().optional(), newReviewUri: z.string().optional() })
          .optional(),
      })
    )
    .optional(),
  nextPageToken: z.string().optional(),
})

const Reviews = z.looseObject({
  reviews: z.array(z.unknown()).optional(),
  averageRating: z.number().optional(),
  totalReviewCount: z.number().optional(),
  nextPageToken: z.string().optional(),
})

/** A location the shop may pick, with what the storefront links to. */
export interface BusinessLocation {
  /** `accounts/{id}`: the account it was listed under; the reviews are read through it. */
  account: string
  /** `locations/{id}`. */
  location: string
  title: string
  /** The street, district and city in one line; null for a business without a storefront. */
  address: string | null
  /** The place on Google Maps, where its reviews are read. */
  mapsUri: string | null
  /** Google's page to write a review. */
  newReviewUri: string | null
}

/** A page of a location's reviews, with Google's own average and count. */
export interface ReviewsPage {
  reviews: GoogleReviewInput[]
  /** Reviews Google sent that could not be read (no star rating). */
  skipped: number
  averageRating: number | null
  totalReviewCount: number | null
  nextPageToken: string | null
}

// Google's own hosts only: the storefront links to them
const GOOGLE_LINK = /^(?:[\w-]+\.)*(?:google\.com|google\.com\.tr|g\.page|goo\.gl)$/

/** An https address on Google's own hosts, or null. */
export function googleLink(value: string | undefined): string | null {
  if (!value || value.length > 2000) {
    return null
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" && GOOGLE_LINK.test(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

type Location = NonNullable<z.infer<typeof Locations>["locations"]>[number]

const lineOf = (place: Location["storefrontAddress"]): string | null => {
  if (!place) {
    return null
  }
  const parts = [
    ...(place.addressLines ?? []),
    place.locality ?? "",
    place.administrativeArea ?? "",
  ].filter((part) => part.trim() !== "")
  return parts.length > 0 ? parts.join(", ").slice(0, 300) : null
}

export function createBusinessProfileApi(
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> = {}
) {
  const hosts = googleHosts()
  // A fake Google serves its reviewers' photos itself (development and tests only)
  const fake = parseEnv().GOOGLE_BASE_URL
  const photoOrigin = fake ? new URL(fake).origin : undefined
  const client = (baseUrl: string): HttpClient =>
    createHttpClient({ ...options, baseUrl, provider: GOOGLE_PROVIDER, errorCode: apiError })
  const accountManagement = client(hosts.accountManagement)
  const businessInformation = client(hosts.businessInformation)
  const myBusiness = client(hosts.myBusiness)
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

  /** The Business Profile accounts the Google account reaches (its own first). */
  async function listAccounts(token: string): Promise<string[]> {
    const names: string[] = []
    let pageToken: string | undefined
    for (let page = 0; page < MAX_ACCOUNT_PAGES; page += 1) {
      const answer = await accountManagement.request({
        method: "GET",
        path: "/v1/accounts",
        query: { pageSize: 20, ...(pageToken ? { pageToken } : {}) },
        headers: bearer(token),
        schema: Accounts,
      })
      names.push(...(answer.accounts ?? []).map((each) => each.name).filter(isAccountName))
      pageToken = answer.nextPageToken
      if (!pageToken) {
        break
      }
    }
    return names
  }

  /** An account's locations, with their title, address and Google links. */
  async function listLocations(token: string, account: string): Promise<BusinessLocation[]> {
    const found: BusinessLocation[] = []
    let pageToken: string | undefined
    for (let page = 0; page < MAX_LOCATION_PAGES; page += 1) {
      const answer = await businessInformation.request({
        method: "GET",
        path: `/v1/${checked(account, ACCOUNT, "Business Profile account")}/locations`,
        query: {
          readMask: "name,title,storefrontAddress,metadata",
          pageSize: 100,
          ...(pageToken ? { pageToken } : {}),
        },
        headers: bearer(token),
        schema: Locations,
      })
      for (const location of answer.locations ?? []) {
        if (!isLocationName(location.name)) {
          continue
        }
        found.push({
          account,
          location: location.name,
          title: (location.title ?? "").slice(0, 200) || location.name,
          address: lineOf(location.storefrontAddress),
          mapsUri: googleLink(location.metadata?.mapsUri),
          newReviewUri: googleLink(location.metadata?.newReviewUri),
        })
      }
      pageToken = answer.nextPageToken
      if (!pageToken) {
        break
      }
    }
    return found
  }

  /** One page of a location's reviews, newest change first (Google's default order). */
  async function listReviews(
    token: string,
    account: string,
    location: string,
    pageToken?: string
  ): Promise<ReviewsPage> {
    const answer = await myBusiness.request({
      method: "GET",
      path: `/v4/${checked(account, ACCOUNT, "Business Profile account")}/${checked(location, LOCATION, "location")}/reviews`,
      query: { pageSize: REVIEWS_PAGE_SIZE, ...(pageToken ? { pageToken } : {}) },
      headers: bearer(token),
      schema: Reviews,
    })
    const read = (answer.reviews ?? []).map((raw) => reviewOf(raw, photoOrigin))
    const reviews = read.filter((review): review is GoogleReviewInput => review !== null)
    return {
      reviews,
      skipped: read.length - reviews.length,
      averageRating: answer.averageRating ?? null,
      totalReviewCount: answer.totalReviewCount ?? null,
      nextPageToken: answer.nextPageToken ?? null,
    }
  }

  return { listAccounts, listLocations, listReviews }
}

export type BusinessProfileApi = ReturnType<typeof createBusinessProfileApi>

let shared: { key: string; api: BusinessProfileApi } | undefined

/** One client per set of hosts (a fake server's in tests). */
export function businessProfileApi(): BusinessProfileApi {
  const key = JSON.stringify(googleHosts())
  if (shared?.key !== key) {
    shared = { key, api: createBusinessProfileApi() }
  }
  return shared.api
}
