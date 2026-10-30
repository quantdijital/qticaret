import { heldToCookieConsent, newVisitorId, visitorCookie, visitorIdOf } from "../visitor"

describe("the storefront's visitor cookie (F13.8)", () => {
  it("reads only an id of ours from the Cookie header", () => {
    const id = newVisitorId()

    expect(id).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(visitorIdOf(`_ga=GA1.1.1; qt_vid=${id}; other=x`)).toBe(id)
    expect(visitorIdOf("qt_vid=kısa")).toBeNull()
    expect(visitorIdOf(`qt_vid=${id}x`)).toBeNull()
    expect(visitorIdOf(undefined)).toBeNull()
  })

  it("keeps it from scripts and other sites for thirteen months, over HTTPS when live", () => {
    expect(visitorCookie("abc", true)).toBe(
      "qt_vid=abc; Path=/; Max-Age=34214400; HttpOnly; SameSite=Lax; Secure"
    )
    expect(visitorCookie("abc", false)).not.toContain("Secure")
  })

  it("never allows more than the banner answer, and lets the storefront only narrow it", () => {
    const answer = { analytics: true, marketing: false }

    expect(heldToCookieConsent({}, answer)).toEqual(answer)
    expect(heldToCookieConsent({ analytics: true, marketing: true }, answer)).toEqual(answer)
    expect(heldToCookieConsent({ analytics: false }, answer)).toEqual({
      analytics: false,
      marketing: false,
    })
  })
})
