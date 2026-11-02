import { describe, expect, it } from "vitest"
import { allowedTags, measureConsentOf, NO_CONSENT } from "../consent"
import { NO_TRACKING, trackingIdsOf } from "../ids"

const answer = (analytics: boolean, marketing: boolean, version: number | null = 3) => ({
  consent: { analytics, marketing, policy_version: version },
  policy_version: 3,
})

describe("the consent gate", () => {
  it("allows nothing without an answer under the policy now", () => {
    expect(measureConsentOf(null)).toEqual(NO_CONSENT)
    expect(measureConsentOf({ consent: null, policy_version: 3 })).toEqual(NO_CONSENT)
    // An answer under an older policy: the banner asks again, nothing loads meanwhile
    expect(measureConsentOf(answer(true, true, 2))).toEqual(NO_CONSENT)
  })

  it("takes the answer in force as given", () => {
    expect(measureConsentOf(answer(true, false))).toEqual({ analytics: true, marketing: false })
    expect(measureConsentOf(answer(false, true))).toEqual({ analytics: false, marketing: true })
  })

  it("gives GA4 with analytics and Meta with marketing, only for tags the shop connected", () => {
    const ids = { ga4: "G-ABC123", meta: "1234567890" }
    expect(allowedTags(ids, NO_CONSENT)).toEqual(NO_TRACKING)
    expect(allowedTags(ids, { analytics: true, marketing: false })).toEqual({
      ga4: "G-ABC123",
      meta: null,
    })
    expect(allowedTags(ids, { analytics: false, marketing: true })).toEqual({
      ga4: null,
      meta: "1234567890",
    })
    expect(allowedTags(NO_TRACKING, { analytics: true, marketing: true })).toEqual(NO_TRACKING)
  })
})

describe("the shop's tag ids", () => {
  it("reads only ids in their own form", () => {
    expect(trackingIdsOf({ ga4_measurement_id: "G-ABC123", meta_pixel_id: "1234567890" })).toEqual({
      ga4: "G-ABC123",
      meta: "1234567890",
    })
    expect(trackingIdsOf(undefined)).toEqual(NO_TRACKING)
    expect(trackingIdsOf({ ga4_measurement_id: null, meta_pixel_id: null })).toEqual(NO_TRACKING)
    expect(trackingIdsOf({ ga4_measurement_id: 'G-1"><script>', meta_pixel_id: "12ab" })).toEqual(
      NO_TRACKING
    )
    expect(trackingIdsOf({ ga4_measurement_id: "UA-1234-1" }).ga4).toBeNull()
  })
})
