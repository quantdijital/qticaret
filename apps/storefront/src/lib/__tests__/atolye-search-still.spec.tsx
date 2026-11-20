// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import type { SearchSuggestView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { shopFixture } from "@/test/theme-render"
// The theme's own parts: it exports pages, not these
import { SearchBox } from "../../../../../packages/themes/atolye/src/frame/SearchBox"
import { SearchDrop } from "../../../../../packages/themes/atolye/src/frame/SearchDrop"
import { SearchLink } from "../../../../../packages/themes/atolye/src/frame/SearchLink"
import { SearchToggle } from "../../../../../packages/themes/atolye/src/frame/SearchToggle"
import { searchOf } from "../../../../../packages/themes/atolye/src/frame/header-words"
import { keepInPanel } from "../../../../../packages/themes/atolye/src/frame/search-panel-fit"

/**
 * Typing in the search never moves the page (owner 2026-11-20: "arama
 * yaparken ekran yukarı aşağı kayıyor"), the field's side: the arrow keys
 * scroll the panel alone, and every focus the search moves itself asks the
 * page to stay. The stylesheet's side: `atolye-search-still-css.spec.ts`.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const rect = (top: number, bottom: number) =>
  ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top }) as DOMRect

describe("keepInPanel", () => {
  const panel = (scrollTop: number) => {
    const element = document.createElement("div")
    element.scrollTop = scrollTop
    element.getBoundingClientRect = () => rect(100, 400)
    return element
  }
  const option = (top: number, bottom: number) => {
    const element = document.createElement("a")
    element.getBoundingClientRect = () => rect(top, bottom)
    return element
  }

  it("scrolls the panel down to an option under its end", () => {
    const box = panel(0)
    keepInPanel(box, option(380, 430))
    expect(box.scrollTop).toBe(30)
  })

  it("scrolls the panel up to an option above its top", () => {
    const box = panel(200)
    keepInPanel(box, option(60, 110))
    expect(box.scrollTop).toBe(160)
  })

  it("leaves it where it is for an option in sight", () => {
    const box = panel(50)
    keepInPanel(box, option(150, 200))
    expect(box.scrollTop).toBe(50)
  })
})

describe("the search keeps the page still: the field", () => {
  let host: HTMLDivElement
  let root: Root
  const search = searchOf(shopFixture(), t, "/api/search/suggest")
  const answer: SearchSuggestView = {
    q: "bı",
    total: 12,
    allPath: "/arama?q=b%C4%B1",
    products: [],
    categories: [
      { label: "Çakılar", path: "/kategori/cakilar" },
      { label: "Aksesuar", path: "/kategori/aksesuar" },
    ],
    brands: [],
    suggestions: [],
  }
  let focus: MockInstance<HTMLElement["focus"]>
  // jsdom draws nothing and has no scrollIntoView: one to watch, taken away after
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(JSON.stringify(answer), { status: 200 }))
    )
    Element.prototype.scrollIntoView = scrollIntoView
    focus = vi.spyOn(HTMLElement.prototype, "focus")
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    focus.mockRestore()
    scrollIntoView.mockReset()
    Reflect.deleteProperty(Element.prototype, "scrollIntoView")
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const type = (field: HTMLInputElement, text: string) => {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, text)
      field.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }
  const key = (field: HTMLInputElement, name: string) => {
    act(() => {
      field.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }))
    })
  }
  const field = (id: string) => {
    const element = document.getElementById(id)
    if (!(element instanceof HTMLInputElement)) {
      throw new Error(`no field ${id}`)
    }
    return element
  }
  /** Each focus the search gave asked the page to stay. */
  const stayed = () => {
    expect(focus).toHaveBeenCalled()
    for (const call of focus.mock.calls) {
      expect(call[0]).toEqual({ preventScroll: true })
    }
  }

  it("moves through the options by scrolling the panel, never the page", async () => {
    vi.useFakeTimers()
    act(() => {
      root.render(<SearchBox {...search} id="arama-genis" />)
    })
    const input = field("arama-genis")
    type(input, "bı")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    const panel = host.querySelector<HTMLElement>(".gf-suggest")
    if (!panel) {
      throw new Error("no panel")
    }
    panel.getBoundingClientRect = () => rect(100, 200)
    for (const link of panel.querySelectorAll<HTMLElement>("[role=option]")) {
      link.getBoundingClientRect = () => rect(180, 230)
    }
    key(input, "ArrowDown")
    expect(input.getAttribute("aria-activedescendant")).not.toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(panel.scrollTop).toBe(30)

    // Escape closes the panel, then clears; the field keeps the focus where it is
    key(input, "Escape")
    expect(input.getAttribute("aria-expanded")).toBe("false")
    key(input, "Escape")
    expect(input.value).toBe("")
    stayed()
  })

  it("opens the wide magnifier's box and goes back to it without moving the page", () => {
    act(() => {
      root.render(
        <SearchToggle {...search} id="arama-genis" align="end" openLabel={t("search.open")} />
      )
    })
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Aramayı aç"]')
    act(() => {
      button?.click()
    })
    const input = field("arama-genis")
    key(input, "Escape")
    expect(document.activeElement).toBe(button)
    stayed()
  })

  it("drops the phone's search and gives the focus back without moving the page", async () => {
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
    act(() => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
    })
    const input = field("arama-dar")
    expect(document.activeElement).toBe(input)
    key(input, "Escape")
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0))
    })
    expect(document.activeElement).toBe(link)
    stayed()
  })
})
