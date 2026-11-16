// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"
import { shopFixture } from "@/test/theme-render"
// The theme's own parts: it exports pages, not these
import { PhoneSearch } from "../../../../../packages/themes/atolye/src/frame/PhoneSearch"
import { SearchToggle } from "../../../../../packages/themes/atolye/src/frame/SearchToggle"
import { searchOf } from "../../../../../packages/themes/atolye/src/frame/header-words"

/**
 * Escape in a search that opens on a press (adr/0049 Ek 2026-11-15, the
 * wide screen's magnifier): the live panel first, then the box, the focus
 * back on what opened it; with no panel, one Escape closes the box. A
 * phone's search is the pill that is always there (owner 2026-11-16, every
 * header): Escape closes its panel, then clears its words, the focus kept.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("Escape in a search that opens on a press", () => {
  let host: HTMLDivElement
  let root: Root
  // A live search address: two characters typed and the panel shows its loading rows
  const search = searchOf(shopFixture(), t, "/api/search/suggest")

  beforeEach(() => {
    // The answer never comes: the panel stays on its loading rows
    vi.stubGlobal("fetch", () => new Promise(() => undefined))
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    vi.unstubAllGlobals()
  })

  const press = (target: Element) => {
    act(() => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      )
    })
  }

  const type = (field: HTMLInputElement, text: string) => {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, text)
      field.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }

  const field = (id: string) => {
    const element = document.getElementById(id)
    if (!(element instanceof HTMLInputElement)) {
      throw new Error(`no field ${id}`)
    }
    return element
  }

  it("on a wide screen: the panel, then the box, back to the magnifier", () => {
    act(() => {
      root.render(
        <SearchToggle {...search} id="arama-genis" align="end" openLabel={t("search.open")} />
      )
    })
    const toggle = host.querySelector<HTMLElement>("[data-search-toggle]")
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Aramayı aç"]')
    if (!toggle || !button) {
      throw new Error("no toggle")
    }
    act(() => {
      button.click()
    })
    const input = field("arama-genis")
    type(input, "bı")
    expect(input.getAttribute("aria-expanded")).toBe("true")

    press(input)
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(toggle.hasAttribute("data-open")).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("bı")

    press(input)
    expect(toggle.hasAttribute("data-open")).toBe(false)
    expect(document.activeElement).toBe(button)
    expect(input.value).toBe("bı")
  })

  it("on a phone: the pill's panel first, then its words, the focus kept in it", () => {
    act(() => {
      root.render(<PhoneSearch {...search} />)
    })
    const input = field("arama-dar")
    act(() => {
      input.focus()
    })
    type(input, "bı")
    expect(input.getAttribute("aria-expanded")).toBe("true")

    press(input)
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("bı")

    press(input)
    expect(input.value).toBe("")
    expect(document.activeElement).toBe(input)
    // Nothing to close: the pill stays, no layer was ever opened
    expect(document.querySelector("[role=dialog]")).toBeNull()
  })
})
