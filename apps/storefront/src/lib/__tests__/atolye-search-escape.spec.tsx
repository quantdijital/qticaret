// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"
import { shopFixture } from "@/test/theme-render"
// The theme's own parts: it exports pages, not these
import { SearchDrop } from "../../../../../packages/themes/atolye/src/frame/SearchDrop"
import { SearchLink } from "../../../../../packages/themes/atolye/src/frame/SearchLink"
import { SearchToggle } from "../../../../../packages/themes/atolye/src/frame/SearchToggle"
import { searchOf } from "../../../../../packages/themes/atolye/src/frame/header-words"

/**
 * Escape in a search that opens on a press (adr/0049 Ek 2026-11-15) is the
 * same on every width: the live panel first, then the box (the wide
 * screen's magnifier, the phone's dropping layer), the focus back on what
 * opened it. With no panel, one Escape closes the box.
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

  /** Radix gives the focus back a task later. */
  const settle = async () => {
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0))
    })
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

  it("on a phone: the panel, then the layer, back to Ara; one Escape with no panel", async () => {
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
    const open = () => {
      act(() => {
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
      })
    }
    open()
    const input = field("arama-dar")
    expect(document.activeElement).toBe(input)
    type(input, "bı")
    expect(input.getAttribute("aria-expanded")).toBe("true")

    press(input)
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(document.querySelector("[data-search-drop]")).not.toBeNull()
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("bı")

    press(input)
    expect(document.querySelector("[data-search-drop]")).toBeNull()
    await settle()
    expect(document.activeElement).toBe(link)

    // No panel (nothing typed): one Escape closes the layer
    open()
    const again = field("arama-dar")
    type(again, "")
    expect(again.getAttribute("aria-expanded")).toBe("false")
    press(again)
    expect(document.querySelector("[data-search-drop]")).toBeNull()
    await settle()
    expect(document.activeElement).toBe(link)
  })
})
