// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderBarView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * Every header's action button (the catalog header's highlighted link,
 * shared by the standard and centred headers): from 1024 px after the
 * tools, hidden in the row on a phone (the menu sheet carries it). None
 * set: the header's HTML as before it (the preset lock's ground).
 */

const bar = (
  variant: "standard" | "centered",
  more: Partial<HeaderBarView> = {}
): HeaderBarView => ({
  id: "mainheader",
  variant,
  sticky: true,
  ...more,
})

const html = (headerBar: HeaderBarView) => renderFrame(atolyeTheme, shopFixture({ headerBar }))

const head = (headerBar: HeaderBarView) => {
  const doc = new DOMParser().parseFromString(html(headerBar), "text/html")
  const header = doc.querySelector("[data-gf-head]")
  if (!header) {
    throw new Error("no header")
  }
  return header
}

const ACTION = { label: "Rezervasyon", path: "/turlar" }

describe("the header's action button", () => {
  it("draws none while none is set: the same HTML as before it", () => {
    for (const variant of ["standard", "centered"] as const) {
      expect(html(bar(variant, { highlight: null }))).toBe(html(bar(variant)))
      expect(head(bar(variant)).querySelector(".gf-btn")).toBeNull()
    }
  })

  it("draws it after the tools from 1024 px, on the standard and centred headers", () => {
    for (const variant of ["standard", "centered"] as const) {
      const header = head(bar(variant, { highlight: ACTION }))
      const button = header.querySelector<HTMLAnchorElement>("a.gf-btn")
      expect(button?.getAttribute("href")).toBe("/turlar")
      expect(button?.textContent).toBe("Rezervasyon")
      expect(button?.className).toContain("max-lg:hidden")
      // Right after the account, favourites and cart
      const tools = header.querySelector("[data-gf-head-row] nav")
      expect(tools?.nextElementSibling).toBe(button)
    }
  })

  it("keeps the centred header's three columns: the tools and button share the last", () => {
    const row = head(bar("centered", { highlight: ACTION })).querySelector("[data-gf-head-row]")
    expect(row?.children).toHaveLength(3)
    expect(row?.lastElementChild?.className).toContain("justify-self-end")
  })
})
