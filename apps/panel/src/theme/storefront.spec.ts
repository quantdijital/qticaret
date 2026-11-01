import { describe, expect, it } from "vitest"
import { STOREFRONT_THEME_COLOR, storefrontTextOn } from "./storefront"

describe("storefrontTextOn", () => {
  it("writes white on a dark colour and near-black on a light one, as the storefront does", () => {
    expect(storefrontTextOn("#0b5c99")).toBe("#ffffff")
    expect(storefrontTextOn(STOREFRONT_THEME_COLOR)).toBe("#ffffff")
    expect(storefrontTextOn("#ffd400")).toBe("#111113")
    expect(storefrontTextOn("#ffffff")).toBe("#111113")
  })
})
