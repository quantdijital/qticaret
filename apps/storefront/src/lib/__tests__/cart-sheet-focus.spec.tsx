// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
// The theme's own part: it exports pages, not this
import { CartSheet } from "../../../../../packages/themes/atolye/src/frame/CartSheet"
import {
  announceCartAdded,
  sheetDescription,
} from "../../../../../packages/themes/atolye/src/frame/events"

/**
 * The header's cart drawer (Tezgâh audit Y-03): closed, the focus goes
 * back to the cart link that opened it, not to the page's start.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

const WORDS = {
  label: "Sepet, 0 ürün",
  short: "Sepet",
  title: "Sepetim",
  empty: "Sepetiniz boş",
  browse: "Kategorilere göz atın",
  continue: "Alışverişe devam",
  subtotal: "Ara toplam",
  note: "Kargo ödemede",
  viewCart: "Sepete git",
  checkout: "Ödemeye geç",
  close: "Kapat",
  line: {},
} as unknown as Parameters<typeof CartSheet>[0]["words"]

describe("the header's cart drawer", () => {
  it("gives the focus back to the cart link when Escape closes it", async () => {
    act(() => {
      root.render(
        <CartSheet cart={null} count={0} categories={[]} buttonClass="gf-icon-btn" words={WORDS} />
      )
    })
    const link = host.querySelector<HTMLAnchorElement>('a[href="/sepet"]')
    if (!link) {
      throw new Error("no cart link")
    }
    act(() => {
      link.focus()
      link.click()
    })
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")
    expect(dialog).not.toBeNull()
    await act(async () => {
      dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      await new Promise((done) => setTimeout(done, 20))
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(link)
  })

  it("gives the focus back to the add button that opened it, though the busy button dropped it (Z-03)", async () => {
    // jsdom lays nothing out: every element is "shown" here
    const rects = vi
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockReturnValue([{}] as unknown as DOMRectList)
    const add = document.createElement("button")
    add.textContent = "Sepete ekle"
    document.body.append(add)
    act(() => {
      root.render(
        <CartSheet cart={null} count={0} categories={[]} buttonClass="gf-icon-btn" words={WORDS} />
      )
    })
    // Pressed, the button went busy (disabled) and the focus fell to the page
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(document.activeElement).toBe(document.body)
    act(() => {
      announceCartAdded("Sepete eklendi", add)
    })
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")
    expect(dialog).not.toBeNull()
    await act(async () => {
      dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      await new Promise((done) => setTimeout(done, 20))
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(add)
    add.remove()
    rects.mockRestore()
  })

  // A phone under the catalog header: every header cart hidden, the bottom bar's "Sepet" a plain link
  it("opens a sheet for a line that went in though no cart link is shown", () => {
    // jsdom lays nothing out: no element is shown here
    act(() => {
      root.render(
        <CartSheet cart={null} count={0} categories={[]} buttonClass="gf-icon-btn" words={WORDS} />
      )
    })
    act(() => {
      announceCartAdded("Sepete eklendi")
    })
    const dialogs = document.querySelectorAll("[role=dialog]")
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]?.textContent).toContain("Sepete eklendi")
  })

  it("opens one sheet only when two are mounted and none is shown", () => {
    act(() => {
      root.render(
        <>
          <CartSheet cart={null} count={0} categories={[]} buttonClass="a" words={WORDS} />
          <CartSheet cart={null} count={0} categories={[]} buttonClass="b" words={WORDS} />
        </>
      )
    })
    act(() => {
      announceCartAdded("Sepete eklendi")
    })
    expect(document.querySelectorAll("[role=dialog]")).toHaveLength(1)
  })

  it("opens the shown cart's sheet only when two are mounted (a cart a screen width)", () => {
    // Only the second link is laid out
    const rects = vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
      this: HTMLElement
    ) {
      return (this.classList.contains("shown") ? [{}] : []) as unknown as DOMRectList
    })
    act(() => {
      root.render(
        <>
          <CartSheet
            cart={null}
            count={0}
            categories={[]}
            buttonClass="hidden-one"
            words={{ ...WORDS, title: "Birinci" }}
          />
          <CartSheet
            cart={null}
            count={0}
            categories={[]}
            buttonClass="shown"
            words={{ ...WORDS, title: "İkinci" }}
          />
        </>
      )
    })
    act(() => {
      announceCartAdded("Sepete eklendi")
    })
    const dialogs = document.querySelectorAll("[role=dialog]")
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]?.textContent).toContain("İkinci")
    rects.mockRestore()
  })

  // The product page's and the quick view's words end in a stop: never "Sepete eklendi.. Sepet"
  it("says what came with the line and the cart's name with one stop between", () => {
    expect(sheetDescription("Sepete eklendi.", "Sepet, 2 ürün")).toBe(
      "Sepete eklendi. Sepet, 2 ürün"
    )
    expect(sheetDescription("Sepete eklendi", "Sepet, 2 ürün")).toBe(
      "Sepete eklendi. Sepet, 2 ürün"
    )
    expect(sheetDescription("", "Sepet")).toBe("Sepet")
  })
})
