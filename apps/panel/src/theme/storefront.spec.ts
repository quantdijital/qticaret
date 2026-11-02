import { describe, expect, it } from "vitest"
import {
  STOREFRONT_BACKGROUNDS,
  STOREFRONT_THEME_COLOR,
  contrastRatio,
  primaryReadable,
  storefrontTextOn,
} from "./storefront"

describe("storefrontTextOn", () => {
  it("writes white on a dark colour and near-black on a light one, as the storefront does", () => {
    expect(storefrontTextOn("#0b5c99")).toBe("#ffffff")
    expect(storefrontTextOn(STOREFRONT_THEME_COLOR)).toBe("#ffffff")
    expect(storefrontTextOn("#ffd400")).toBe("#111113")
    expect(storefrontTextOn("#ffffff")).toBe("#111113")
  })
})

describe("primaryReadable", () => {
  it("asks 3:1 against white and against the chosen page colour, as the server does", () => {
    expect(primaryReadable("#0b5c99", "warm")).toBe(true)
    expect(primaryReadable(STOREFRONT_THEME_COLOR, "cool")).toBe(true)
    // Yellow takes no white text
    expect(primaryReadable("#ffd400", "warm")).toBe(false)
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21)
  })

  it("judges a colour by the page it sits on", () => {
    // Just over 3:1 on white; the bone page is darker, so it falls short there
    const color = "#8f8f8f"
    expect(contrastRatio(color, "#ffffff")).toBeGreaterThanOrEqual(3)
    expect(primaryReadable(color, "warm")).toBe(false)
    // Passes on the neutral page, not on the warmer one
    expect(primaryReadable("#2f8dff", "neutral")).toBe(true)
    expect(primaryReadable("#2f8dff", "warm")).toBe(false)
    expect(Object.keys(STOREFRONT_BACKGROUNDS)).toEqual(["warm", "neutral", "cool"])
  })
})
