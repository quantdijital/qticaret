// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderSearchStyle } from "@qticaret/types"
import type { HeaderBarView, HeaderCatalogView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderFrame, shopFixture } from "@/test/theme-render"
// The theme's own parts: it exports pages, not these
import { SearchDrop } from "../../../../../packages/themes/atolye/src/frame/SearchDrop"
import { SearchDropOpener } from "../../../../../packages/themes/atolye/src/frame/SearchDropOpener"
import { searchOf } from "../../../../../packages/themes/atolye/src/frame/header-words"

/**
 * A phone's search in the theme editor's preview (adr/0049 Ek 2026-11-15
 * and 2026-11-16, adr/0065): a preview draws no bottom bar, so a phone
 * there would have no way into the dropping search; the editor's live
 * session (and only it) puts a magnifier in the header's row under
 * 1024 px, in every variant and whatever the search style. A live phone's
 * header shows no search at all (owner's request): its HTML has no such
 * button.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const CATALOG: HeaderCatalogView = {
  searchPlaceholder: null,
  searchLabel: true,
  accountText: true,
  cartTotal: false,
  highlight: null,
  utilityBar: false,
  phone: false,
  categories: [],
  menuGround: "stage",
}

const VARIANTS = ["standard", "centered", "catalog"] as const

const bar = (variant: HeaderBarView["variant"], searchStyle: HeaderSearchStyle): HeaderBarView => ({
  id: "mainheader",
  variant,
  sticky: true,
  searchStyle,
  ...(variant === "catalog" ? { catalog: CATALOG } : {}),
})

/** The header as the server prints it, live or in the editor's session, read back. */
const head = (headerBar: HeaderBarView, editor: boolean) => {
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

describe("the phone's way into the search in the editor's preview, as the server prints it", () => {
  it("prints nothing of it on a live page, icon or field, on every variant", () => {
    for (const variant of VARIANTS) {
      for (const style of ["icon", "field"] as const) {
        const html = renderFrame(atolyeTheme, shopFixture({ headerBar: bar(variant, style) }))
        expect(html).not.toContain("data-search-drop-opener")
      }
      // The live icon header: one search, the wide screen's toggle; no phone field, no other opener
      const header = head(bar(variant, "icon"), false)
      expect(header.querySelectorAll('[aria-label="Aramayı aç"]')).toHaveLength(1)
      expect(header.querySelector('[data-search-toggle] [aria-label="Aramayı aç"]')).not.toBeNull()
      expect(header.querySelector("#arama-dar")).toBeNull()
      // The live box header: no opener, no phone field either
      const boxed = head(bar(variant, "field"), false)
      expect(boxed.querySelector('[aria-label="Aramayı aç"]')).toBeNull()
      expect(boxed.querySelector("#arama-dar")).toBeNull()
    }
  })

  it("puts a phone-only magnifier in the editor's header row, icon or box, on every variant", () => {
    for (const variant of VARIANTS) {
      for (const style of ["icon", "field"] as const) {
        const label = `${variant} ${style}`
        const header = head(bar(variant, style), true)
        const opener = header.querySelectorAll<HTMLButtonElement>("[data-search-drop-opener]")
        expect(opener, label).toHaveLength(1)
        const [button] = opener
        expect(button?.getAttribute("type"), label).toBe("button")
        expect(button?.getAttribute("aria-label"), label).toBe("Aramayı aç")
        expect(button?.getAttribute("aria-haspopup"), label).toBe("dialog")
        expect(button?.className.split(" "), label).toContain("lg:hidden")
        expect(button?.closest("[data-gf-head-row]"), label).not.toBeNull()
        expect(header.querySelector("#arama-dar"), label).toBeNull()
      }
    }
  })
})

describe("the editor's magnifier, in the browser", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it("drops the search from the top and takes the focus back when it closes", async () => {
    const search = searchOf(shopFixture(), t, undefined)
    act(() => {
      root.render(
        <>
          <SearchDropOpener label={t("search.open")} className="" />
          <SearchDrop {...search} title={t("search.title")} closeLabel={t("search.close")} />
        </>
      )
    })
    const button = host.querySelector<HTMLButtonElement>("[data-search-drop-opener]")
    if (!button) {
      throw new Error("no opener")
    }
    act(() => {
      button.click()
    })
    expect(document.querySelector("[data-search-drop]")).not.toBeNull()
    const field = document.getElementById("arama-dar")
    expect(document.activeElement).toBe(field)
    act(() => {
      field?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      )
    })
    expect(document.querySelector("[data-search-drop]")).toBeNull()
    // Radix gives the focus back a task later
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0))
    })
    expect(document.activeElement).toBe(button)
  })
})
