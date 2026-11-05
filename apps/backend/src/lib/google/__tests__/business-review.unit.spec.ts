import { googleLink } from "../business-profile"
import { MAX_COMMENT, photoOf, reviewOf } from "../business-review"
import {
  BUSINESS_PROFILE_SCOPE,
  REVIEWS_STATE_PREFIX,
  authorizationUrl,
  hasScope,
  panelPathOfState,
} from "../oauth"

const review = (over: Record<string, unknown> = {}) => ({
  name: "accounts/1/locations/2/reviews/AbFvOqk1",
  reviewId: "AbFvOqk1",
  reviewer: {
    displayName: "Mehmet Kaya",
    profilePhotoUrl: "https://lh3.googleusercontent.com/a-/ALV-UjX=s120-c-rp-mo-br100",
    isAnonymous: false,
  },
  starRating: "FOUR",
  comment: "Bıçak çok keskin, kılıfı sağlam.",
  createTime: "2026-10-30T09:15:00Z",
  updateTime: "2026-10-31T10:00:00.123Z",
  reviewReply: {
    comment: "Teşekkür ederiz.",
    updateTime: "2026-10-31T12:00:00Z",
    reviewReplyState: "APPROVED",
  },
  ...over,
})

/** adr/0058: a Google review as Business Profile's v4 `Review` gives it, made what we keep. */
describe("a Google review read", () => {
  it("keeps Google's id, the reviewer, the stars 1 to 5, the text, the dates and the reply", () => {
    expect(reviewOf(review())).toEqual({
      review_id: "AbFvOqk1",
      reviewer_name: "Mehmet Kaya",
      reviewer_photo_url: "https://lh3.googleusercontent.com/a-/ALV-UjX=s120-c-rp-mo-br100",
      rating: 4,
      comment: "Bıçak çok keskin, kılıfı sağlam.",
      written_at: new Date("2026-10-30T09:15:00Z"),
      edited_at: new Date("2026-10-31T10:00:00.123Z"),
      reply: "Teşekkür ederiz.",
      replied_at: new Date("2026-10-31T12:00:00Z"),
    })
  })

  it("leaves out what Google does not show: an anonymous name and photo, a reply not approved", () => {
    const anonymous = reviewOf(
      review({ reviewer: { displayName: "A Google User", isAnonymous: true } })
    )
    const pending = reviewOf(
      review({ reviewReply: { comment: "Bakıyoruz.", reviewReplyState: "PENDING" } })
    )
    const rejected = reviewOf(
      review({ reviewReply: { comment: "…", reviewReplyState: "REJECTED" } })
    )
    // A reply without a state is one Google shows (the field is output only, often absent)
    const plain = reviewOf(review({ reviewReply: { comment: "Sağ olun." } }))

    expect(anonymous).toMatchObject({ reviewer_name: null, reviewer_photo_url: null })
    expect(pending).toMatchObject({ reply: null, replied_at: null })
    expect(rejected).toMatchObject({ reply: null })
    expect(plain).toMatchObject({ reply: "Sağ olun.", replied_at: null })
  })

  it("reads a review without text, and the id from the name when `reviewId` is missing", () => {
    expect(reviewOf(review({ comment: undefined, reviewId: undefined }))).toMatchObject({
      review_id: "AbFvOqk1",
      comment: null,
    })
    expect(reviewOf(review({ comment: "   " }))?.comment).toBeNull()
    expect(reviewOf(review({ comment: "a".repeat(MAX_COMMENT + 10) }))?.comment).toHaveLength(
      MAX_COMMENT
    )
  })

  it("skips a review it cannot show: no stars, no date, a bent id, not an object", () => {
    expect(reviewOf(review({ starRating: "STAR_RATING_UNSPECIFIED" }))).toBeNull()
    expect(reviewOf(review({ starRating: undefined }))).toBeNull()
    expect(reviewOf(review({ createTime: "dün" }))).toBeNull()
    expect(reviewOf(review({ reviewId: "../../x y", name: undefined }))).toBeNull()
    expect(reviewOf("yorum")).toBeNull()
  })

  it("takes a photo only from Google's own hosts over https (or a fake Google's own address)", () => {
    expect(photoOf("https://lh5.googleusercontent.com/a/x=s120")).toBe(
      "https://lh5.googleusercontent.com/a/x=s120"
    )
    expect(photoOf("http://lh3.googleusercontent.com/a/x")).toBeNull()
    expect(photoOf("https://googleusercontent.com.example.com/a/x")).toBeNull()
    expect(photoOf("javascript:alert(1)")).toBeNull()
    expect(photoOf("http://127.0.0.1:9109/a/x=s120", "http://127.0.0.1:9109")).toBe(
      "http://127.0.0.1:9109/a/x=s120"
    )
    expect(photoOf("http://127.0.0.1:9110/a/x", "http://127.0.0.1:9109")).toBeNull()
  })

  it("links only to Google's own pages over https", () => {
    expect(googleLink("https://maps.google.com/maps?cid=1267")).toBe(
      "https://maps.google.com/maps?cid=1267"
    )
    expect(googleLink("https://search.google.com/local/writereview?placeid=ChIJ")).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJ"
    )
    expect(googleLink("https://g.page/r/abc/review")).toBe("https://g.page/r/abc/review")
    expect(googleLink("https://maps.google.com.evil.example/x")).toBeNull()
    expect(googleLink("http://maps.google.com/x")).toBeNull()
    expect(googleLink(undefined)).toBeNull()
  })
})

/** adr/0058: Business Profile's scope asked only for the reviews, on top, and back to them. */
describe("connecting for Google reviews", () => {
  const client = { clientId: "istemci.apps.googleusercontent.com", clientSecret: "sir" }
  const input = { state: "s", challenge: "c", redirectUri: "https://magaza.example.com/cb" }

  it("asks Business Profile's scope on top of the usual ones, keeping what was allowed", () => {
    const usual = new URL(authorizationUrl(client, input, "https://accounts.google.com"))
    const reviews = new URL(
      authorizationUrl(
        client,
        { ...input, extraScopes: [BUSINESS_PROFILE_SCOPE] },
        "https://accounts.google.com"
      )
    )

    expect(usual.searchParams.get("scope")).not.toContain(BUSINESS_PROFILE_SCOPE)
    expect(reviews.searchParams.get("scope")?.split(" ")).toEqual(
      expect.arrayContaining([
        "https://www.googleapis.com/auth/content",
        "https://www.googleapis.com/auth/webmasters",
        BUSINESS_PROFILE_SCOPE,
      ])
    )
    expect(reviews.searchParams.get("include_granted_scopes")).toBe("true")
  })

  it("goes back to the panel page the connection started from", () => {
    expect(panelPathOfState(`${REVIEWS_STATE_PREFIX}abc`)).toBe("/reviews/google")
    expect(panelPathOfState("abc")).toBe("/settings/marketing")
    expect(panelPathOfState(undefined)).toBe("/settings/marketing")
  })

  it("reads the scopes kept as Google granted them", () => {
    expect(hasScope(`openid ${BUSINESS_PROFILE_SCOPE}`, BUSINESS_PROFILE_SCOPE)).toBe(true)
    expect(hasScope(`${BUSINESS_PROFILE_SCOPE}x`, BUSINESS_PROFILE_SCOPE)).toBe(false)
    expect(hasScope(undefined, BUSINESS_PROFILE_SCOPE)).toBe(false)
  })
})
