import { describe, expect, it } from "vitest"
import {
  REVIEWS_PRODUCT_IMAGES,
  REVIEWS_PRODUCT_IMAGE_DEFAULT,
  reviewsProductImageOf,
} from "../store/section-reviews.js"

describe("the reviews carousel's product picture (adr/0077 §10 Ek)", () => {
  it("lists none, a small square and a cover; none by default, today's card", () => {
    expect(REVIEWS_PRODUCT_IMAGES).toEqual(["none", "thumb", "cover", "compact"])
    expect(REVIEWS_PRODUCT_IMAGE_DEFAULT).toBe("none")
  })

  it("reads a step on the list as itself, anything else as none", () => {
    expect(reviewsProductImageOf("cover")).toBe("cover")
    expect(reviewsProductImageOf("thumb")).toBe("thumb")
    expect(reviewsProductImageOf(undefined)).toBe("none")
    expect(reviewsProductImageOf("poster")).toBe("none")
  })
})
