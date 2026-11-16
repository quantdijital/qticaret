// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderSearchStyle } from "@qticaret/types"
import type { HeaderBarView, HeaderCatalogView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * A phone's search, the same in every header (owner 2026-11-16: "tüm
 * headerlerde katalogdaki gibi çalışsın arama"): the catalog header's own,
 * a search pill always there under the top row below 1024 px
 * (`PhoneSearch`), whatever the variant and whatever the search style; the
 * shop's `search_style: icon` is a wide screen's magnifier only. No layer
 * drops down any more and the editor's preview puts no opener in the row.
 */

const CATALOG: HeaderCatalogView = {
  searchPlaceholder: null,
  searchLabel: false,
  accountText: true,
  cartTotal: false,
  highlight: null,
  utilityBar: false,
  phone: true,
  categories: [],
  menuGround: "stage",
}

const VARIANTS = ["standard", "centered", "catalog"] as const
const STYLES = ["field", "icon"] as const

const bar = (variant: HeaderBarView["variant"], searchStyle: HeaderSearchStyle): HeaderBarView => ({
  id: "mainheader",
  variant,
  sticky: true,
  searchStyle,
  ...(variant === "catalog" ? { catalog: CATALOG } : {}),
})

/** The header as the server prints it, live or in the editor's session, read back. */
const head = (headerBar: HeaderBarView, editor = false) => {
  const doc = new DOMParser().parseFromString(
    renderFrame(atolyeTheme, shopFixture({ headerBar, ...(editor ? { editor: true } : {}) })),
    "text/html"
  )
  const header = doc.querySelector("[data-gf-head]")
  if (!header) {
    throw new Error("no header")
  }
  return header
}

/** The phone's search part: the box holding the field `arama-dar`. */
const phonePart = (header: Element) => {
  const fields = header.querySelectorAll("input#arama-dar")
  expect(fields).toHaveLength(1)
  const part = fields[0]?.closest("[role=search]")?.parentElement
  if (!part) {
    throw new Error("no phone search part")
  }
  return part
}

describe("a phone's search in every header (owner 2026-11-16)", () => {
  it("is the catalog header's pill under the top row, in every variant and search style", () => {
    const reference = phonePart(head(bar("catalog", "field")))
    for (const variant of VARIANTS) {
      for (const style of STYLES) {
        for (const editor of [false, true]) {
          const header = head(bar(variant, style), editor)
          const part = phonePart(header)
          const label = `${variant} ${style}${editor ? " editor" : ""}`
          // Shown below 1024 px only, the headers' own step; never inside the folding row
          expect(part.className.split(" "), label).toEqual(
            expect.arrayContaining(["pb-2", "lg:hidden"])
          )
          expect(part.closest("[data-gf-head-row]"), label).toBeNull()
          expect(part.previousElementSibling?.hasAttribute("data-gf-head-row"), label).toBe(true)
          // The same part, attribute for attribute, as the catalog header's (editor marks aside)
          if (!editor) {
            expect(part.outerHTML, label).toBe(reference.outerHTML)
          }
          // No dropping layer and no opener for one
          expect(header.querySelector("[data-search-drop], [data-search-drop-opener]")).toBeNull()
          expect(header.querySelector("[role=dialog]")).toBeNull()
        }
      }
    }
  })

  it("names the search for a screen reader and sends it as the plain form without script", () => {
    const part = phonePart(head(bar("standard", "icon")))
    const form = part.querySelector("form[role=search]")
    expect(form?.getAttribute("action")).toBe("/arama")
    expect(form?.getAttribute("method")?.toLowerCase() ?? "get").toBe("get")
    const field = part.querySelector<HTMLInputElement>("input#arama-dar")
    expect(field?.getAttribute("name")).toBe("q")
    const named =
      field?.getAttribute("aria-label") ??
      part.querySelector(`label[for="arama-dar"]`)?.textContent ??
      null
    expect(named).toBeTruthy()
  })

  it("keeps the wide screen's own look: the box, or the magnifier the shop asked for", () => {
    for (const variant of VARIANTS) {
      expect(head(bar(variant, "field")).querySelector("[data-search-toggle]")).toBeNull()
      expect(head(bar(variant, "icon")).querySelector("[data-search-toggle]")).not.toBeNull()
      expect(head(bar(variant, "icon")).querySelector("input#arama-genis")).not.toBeNull()
    }
  })
})
