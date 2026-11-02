import { describe, expect, it } from "vitest"
import { cookieBannerOf } from "../cookies"

const POLICY = "/yasal/cerez-politikasi"

describe("cookieBannerOf (D9)", () => {
  it("asks by itself while there is no answer, the boxes empty", () => {
    expect(cookieBannerOf({ consent: null, policy_version: 2 }, POLICY)).toEqual({
      policyVersion: 2,
      policyPath: POLICY,
      due: true,
      analytics: false,
      marketing: false,
    })
  })

  it("waits for the footer's link once answered, the answer in force ticked", () => {
    expect(
      cookieBannerOf(
        { consent: { analytics: true, marketing: false, policy_version: 2 }, policy_version: 2 },
        null
      )
    ).toMatchObject({ due: false, analytics: true, marketing: false, policyPath: null })
  })

  it("asks again under a new policy, an older answer ticking none of its boxes", () => {
    expect(
      cookieBannerOf(
        { consent: { analytics: true, marketing: true, policy_version: 1 }, policy_version: 2 },
        POLICY
      )
    ).toMatchObject({ due: true, analytics: false, marketing: false })
  })

  it("lets the preferences page ask instead of the banner, and has nothing when the answer is unread", () => {
    expect(cookieBannerOf({ consent: null, policy_version: 2 }, POLICY, true)?.due).toBe(false)
    expect(cookieBannerOf(null, POLICY)).toBeNull()
  })
})
