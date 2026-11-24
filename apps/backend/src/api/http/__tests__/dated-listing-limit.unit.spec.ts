import type { MedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../../lib/security/rate-limit"
import { CONTENT_ROUTES } from "../content-routes"
import { datedListingProfile } from "../dated-listing-limit"

// adr/0077 §5 Ek: a listing asked with dates has its own, narrower budget

const asked = (query: unknown) => ({ query }) as unknown as Pick<MedusaRequest, "query">

describe("a dated listing's rate limit", () => {
  it("counts a listing asked with dates or months, and only that", () => {
    expect(datedListingProfile(asked({ query: "tarih=2026-12-01_2026-12-10" }))).toBe(
      RATE_LIMIT_PROFILES.dated_listing
    )
    expect(datedListingProfile(asked({ query: "ay=2026-12&sirala=fiyat-artan" }))).toBe(
      RATE_LIMIT_PROFILES.dated_listing
    )
    expect(datedListingProfile(asked({ query: "sirala=fiyat-artan&fiyat=10-20" }))).toBeNull()
    expect(datedListingProfile(asked({ query: "" }))).toBeNull()
    expect(datedListingProfile(asked({}))).toBeNull()
    expect(datedListingProfile(asked({ query: ["tarih=x"] }))).toBeNull()
    expect(RATE_LIMIT_PROFILES.dated_listing.perIp).toEqual({ max: 60, windowMs: 60_000 })
  })

  it("stands on the listing route beside its own budget, before the query is checked", () => {
    const route = CONTENT_ROUTES.find((each) => each.matcher === "/store/listings/products")
    expect(route?.middlewares).toHaveLength(3)
  })
})
