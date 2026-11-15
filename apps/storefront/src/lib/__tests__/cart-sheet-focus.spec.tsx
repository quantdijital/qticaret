// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
// The theme's own part: it exports pages, not this
import { CartSheet } from "../../../../../packages/themes/atolye/src/frame/CartSheet"
import { announceCartAdded } from "../../../../../packages/themes/atolye/src/frame/events"

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
})
