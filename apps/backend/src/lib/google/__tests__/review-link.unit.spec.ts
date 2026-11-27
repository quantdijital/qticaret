import { mapsReviewIdOf, reviewOf } from "../business-review"
import { cidHexOf, reviewLinkOf } from "../review-link"

// A review's Maps id as Business Profile gives it (live answers, 2026-10) and Maps links it
const MAPS_ID = "Ci9DQUlRQUNvZENodHljRjlvT2poeVpXVk9hRkJ0UWtSSmEyRm9NbVJrYkVOS1UyYxAB"
const REPLY_URL = `https://business.google.com/n/1850906632456176734/reviews/${MAPS_ID}`

/** adr/0058 Ek 2026-11-27: each Google review links to itself on Google Maps. */
describe("a Google review's own link", () => {
  it("reads the review's Maps id from the address Business Profile sends", () => {
    expect(mapsReviewIdOf(REPLY_URL)).toBe(MAPS_ID)
    expect(
      reviewOf({
        reviewId: "AbFvOqlWS9uYuDKoqe2M3ZSNMR",
        starRating: "FIVE",
        createTime: "2026-08-17T18:14:20.179378Z",
        reviewReplyUrl: REPLY_URL,
      })
    ).toMatchObject({ review_id: "AbFvOqlWS9uYuDKoqe2M3ZSNMR", maps_review_id: MAPS_ID })
  })

  it("takes no id from another host, another path, plain http or odd characters", () => {
    for (const value of [
      undefined,
      "",
      "not a url",
      `http://business.google.com/n/1/reviews/${MAPS_ID}`,
      `https://business.google.com.evil.example/n/1/reviews/${MAPS_ID}`,
      `https://example.com/n/1/reviews/${MAPS_ID}`,
      `https://business.google.com/n/1/photos/${MAPS_ID}`,
      "https://business.google.com/n/1/reviews/short",
      "https://business.google.com/n/1/reviews/Ci9DQUlRQUNv%3Cscript%3E0000000",
      `https://business.google.com/n/1/reviews/${"A".repeat(600)}`,
    ]) {
      expect(mapsReviewIdOf(value)).toBeNull()
    }
  })

  it("reads the place's CID from its Maps address, in hex", () => {
    expect(cidHexOf("https://maps.google.com/maps?cid=15661312445132789593")).toBe(
      "d95828b1108b5759"
    )
    expect(cidHexOf("https://maps.google.com/maps?cid=0")).toBeNull()
    expect(cidHexOf("https://maps.google.com/maps?cid=99999999999999999999")).toBeNull()
    expect(cidHexOf("https://maps.google.com/maps?q=x")).toBeNull()
    expect(cidHexOf(null)).toBeNull()
  })

  it("links the review open on Google Maps, as Maps writes it; none without the id or the CID", () => {
    expect(reviewLinkOf(MAPS_ID, "https://maps.google.com/maps?cid=15661312445132789593")).toBe(
      `https://www.google.com/maps/reviews/data=!4m6!14m5!1m4!2m3!1s${MAPS_ID}!2m1!1s0x0:0xd95828b1108b5759?hl=tr`
    )
    expect(reviewLinkOf(null, "https://maps.google.com/maps?cid=15661312445132789593")).toBeNull()
    expect(reviewLinkOf(MAPS_ID, null)).toBeNull()
    expect(reviewLinkOf("bad id!", "https://maps.google.com/maps?cid=1")).toBeNull()
  })
})
