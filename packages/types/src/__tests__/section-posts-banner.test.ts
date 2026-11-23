import { describe, expect, it } from "vitest"
import { BANNER_SPLIT_EDGES, bannerSplitEdgeOf } from "../store/section-banner.js"
import { POSTS_INTRO_CARDS, POSTS_INTRO_LIMITS } from "../store/section-posts.js"
import {
  SECTION_VARIANTS,
  defaultVariant,
  hasVariants,
  variantOf,
} from "../store/section-variants.js"

describe("the posts' and the band's variants (adr/0077 Ek, Vadi)", () => {
  it("keeps today's posts grid first, the default, and reads anything else as it", () => {
    expect(SECTION_VARIANTS.posts).toEqual(["grid", "intro_panel"])
    expect(hasVariants("posts")).toBe(true)
    expect(defaultVariant("posts")).toBe("grid")
    expect(variantOf("posts", undefined)).toBe("grid")
    expect(variantOf("posts", "carousel")).toBe("grid")
    expect(variantOf("posts", "intro_panel")).toBe("intro_panel")
    expect(POSTS_INTRO_LIMITS).toEqual({ eyebrow: 40, intro: 200 })
    expect(POSTS_INTRO_CARDS).toBe(3)
  })

  it("keeps today's band first, the default, and reads anything else as it", () => {
    expect(SECTION_VARIANTS.banner).toEqual(["standard", "split"])
    expect(defaultVariant("banner")).toBe("standard")
    expect(variantOf("banner", undefined)).toBe("standard")
    expect(variantOf("banner", "slider")).toBe("standard")
    expect(variantOf("banner", "split")).toBe("split")
  })

  it("reads the split's edge forgivingly, straight by default", () => {
    expect(BANNER_SPLIT_EDGES).toEqual(["straight", "curved"])
    expect(bannerSplitEdgeOf("curved")).toBe("curved")
    expect(bannerSplitEdgeOf("wavy")).toBe("straight")
    expect(bannerSplitEdgeOf(undefined)).toBe("straight")
  })
})
