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
import { SearchLink } from "../../../../../packages/themes/atolye/src/frame/SearchLink"
import { SearchToggle } from "../../../../../packages/themes/atolye/src/frame/SearchToggle"
import { searchOf } from "../../../../../packages/themes/atolye/src/frame/header-words"

/**
 * The header search as an icon (adr/0049 Ek 2026-11-15; adr/0066 K3b):
 * `field`, the default, is the drawing from before (the open box on wide
 * screens, the pill under a phone's row); `icon` draws a magnifier that
 * opens the box from 1024 px, as wide as the header gave the box, and no
 * box on a phone, where the bottom bar's "Ara" drops it from the top.
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

const bar = (
  variant: HeaderBarView["variant"],
  searchStyle?: HeaderSearchStyle,
  catalog: Partial<HeaderCatalogView> = {}
): HeaderBarView => ({
  id: "mainheader",
  variant,
  sticky: true,
  ...(searchStyle === undefined ? {} : { searchStyle }),
  ...(variant === "catalog" ? { catalog: { ...CATALOG, ...catalog } } : {}),
})

/** The header as the server prints it, read back as a document. */
const head = (headerBar: HeaderBarView) => {
  const doc = new DOMParser().parseFromString(
    renderFrame(atolyeTheme, shopFixture({ headerBar })),
    "text/html"
  )
  const header = doc.querySelector("[data-gf-head]")
  if (!header) {
    throw new Error("no header")
  }
  return header
}

describe("the header search's look, as the server prints it", () => {
  it("keeps the open box and the phone's pill by default, on every variant", () => {
    for (const variant of ["standard", "centered", "catalog"] as const) {
      for (const style of [undefined, "field"] as const) {
        const header = head(bar(variant, style))
        expect(header.querySelector("[data-search-toggle]")).toBeNull()
        expect(header.querySelector("input#arama-genis")).not.toBeNull()
        expect(header.querySelector("input#arama-dar")).not.toBeNull()
      }
    }
  })

  it("draws the centred header's magnifier at the row's start, a link without script", () => {
    const header = head(bar("centered", "icon"))
    const toggle = header.querySelector<HTMLElement>("[data-search-toggle]")
    expect(toggle?.dataset["searchToggle"]).toBe("start")
    expect(toggle?.className).toContain("[--gf-search-open:22rem]")
    const link = toggle?.querySelector("a")
    expect(link?.getAttribute("href")).toBe("/arama")
    expect(link?.getAttribute("aria-label")).toBe("Aramayı aç")
    // The box waits inside, the same GET form; a phone's header has none
    expect(
      toggle?.querySelector(".gf-search-toggle__box form[action='/arama'] input#arama-genis")
    ).not.toBeNull()
    expect(header.querySelector("#arama-dar")).toBeNull()
    expect(header.querySelectorAll("[role=search]")).toHaveLength(1)
  })

  it("puts the magnifier beside the tools on the standard and catalog headers, as wide as their box", () => {
    const standard = head(bar("standard", "icon")).querySelector<HTMLElement>(
      "[data-search-toggle]"
    )
    expect(standard?.dataset["searchToggle"]).toBe("end")
    expect(standard?.className).toContain("[--gf-search-open:40rem]")
    const wide = head(bar("catalog", "icon"))
    const toggle = wide.querySelector<HTMLElement>("[data-search-toggle]")
    expect(toggle?.dataset["searchToggle"]).toBe("end")
    expect(toggle?.className).toContain("[--gf-search-open:45rem]")
    // The written "Ara" stays the box's submit
    expect(toggle?.querySelector("button[type=submit]")?.textContent).toBe("Ara")
    expect(wide.querySelector("#arama-dar")).toBeNull()
    const narrow = head(bar("catalog", "icon", { searchWidth: "narrow" }))
    expect(narrow.querySelector("[data-search-toggle]")?.className).toContain(
      "[--gf-search-open:35rem]"
    )
  })
})

describe("the magnifier and the dropping search, in the browser", () => {
  let host: HTMLDivElement
  let root: Root
  const search = searchOf(shopFixture(), t, undefined)

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

  const press = (target: Element, key: string) => {
    act(() => {
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
    })
  }

  it("opens the box with the cursor in it; Escape closes it back to the button, a press outside too", () => {
    act(() => {
      root.render(
        <SearchToggle {...search} id="arama-genis" align="start" openLabel={t("search.open")} />
      )
    })
    const toggle = host.querySelector<HTMLElement>("[data-search-toggle]")
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Aramayı aç"]')
    const box = host.querySelector(".gf-search-toggle__box")
    if (!toggle || !button || !box) {
      throw new Error("no toggle")
    }
    expect(button.getAttribute("aria-expanded")).toBe("false")
    expect(button.getAttribute("aria-controls")).toBe(box.id)
    act(() => {
      button.click()
    })
    const field = host.querySelector<HTMLInputElement>("input#arama-genis")
    expect(button.getAttribute("aria-expanded")).toBe("true")
    expect(toggle.hasAttribute("data-open")).toBe(true)
    expect(document.activeElement).toBe(field)
    if (!field) {
      throw new Error("no field")
    }
    press(field, "Escape")
    expect(toggle.hasAttribute("data-open")).toBe(false)
    expect(document.activeElement).toBe(button)

    act(() => {
      button.click()
    })
    expect(toggle.hasAttribute("data-open")).toBe(true)
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    })
    expect(toggle.hasAttribute("data-open")).toBe(false)
  })

  it("drops a phone's search from the top on the bottom bar's Ara, closing back to it", async () => {
    act(() => {
      root.render(
        <>
          <SearchLink className="" current={false}>
            Ara
          </SearchLink>
          <SearchDrop {...search} title={t("search.title")} closeLabel={t("search.close")} />
        </>
      )
    })
    const link = host.querySelector<HTMLAnchorElement>('a[href="/arama"]')
    if (!link) {
      throw new Error("no link")
    }
    link.focus()
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    act(() => {
      link.dispatchEvent(click)
    })
    // The link stays where it is: the drop heard it
    expect(click.defaultPrevented).toBe(true)
    const drop = document.querySelector<HTMLElement>("[data-search-drop]")
    expect(drop?.getAttribute("role")).toBe("dialog")
    expect(drop?.textContent).toContain("Arama")
    expect(document.activeElement).toBe(document.getElementById("arama-dar"))
    expect(drop?.querySelector('button[aria-label="Aramayı kapat"]')).not.toBeNull()
    press(document.activeElement ?? document.body, "Escape")
    expect(document.querySelector("[data-search-drop]")).toBeNull()
    // Radix gives the focus back a task later
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0))
    })
    expect(document.activeElement).toBe(link)
  })
})
