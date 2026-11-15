// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductCardView, QuickViewView } from "@qticaret/ui"
import { forgetQuickViews } from "@qticaret/ui/lib/quick-view"
import { t } from "@/lib/i18n"
// The theme's own parts: it exports pages, not these
import { ProductCard } from "../../../../../packages/themes/atolye/src/parts/ProductCard"
import { QuickViewHost } from "../../../../../packages/themes/atolye/src/frame/QuickViewHost"
import { CART_ADDED_EVENT } from "../../../../../packages/themes/atolye/src/frame/events"
import { quickViewWords } from "../../../../../packages/themes/atolye/src/frame/quick-view-words"

/**
 * A card's quick view (adr/0049 Ek 2026-11-15): the button beside the
 * card's link on every card variant, the dialog asked on opening, its
 * skeleton, refusals and focus.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  forgetQuickViews()
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

const CARD: ProductCardView = {
  id: "prod_01",
  title: "Katlanır Çakı",
  path: "/urun/katlanir-caki",
  brand: null,
  image: null,
  price: {
    current: "450,00 TL",
    from: false,
    before: null,
    discount: null,
    saving: null,
    cartOffer: null,
  },
  available: true,
}

const PRICE = {
  current: "450,00 TL",
  from: false,
  before: null,
  discount: null,
  saving: null,
  cartOffer: null,
}

const VIEW: QuickViewView = {
  id: "prod_01",
  title: "Katlanır Çakı",
  path: "/urun/katlanir-caki",
  brand: "Atölye",
  images: [],
  options: [{ id: "opt_color", title: "Renk", values: ["Siyah", "Kahve"] }],
  variants: [
    {
      id: "variant_1",
      title: "Siyah",
      options: { opt_color: "Siyah" },
      price: PRICE,
      available: false,
      sku: null,
    },
    {
      id: "variant_2",
      title: "Kahve",
      options: { opt_color: "Kahve" },
      price: PRICE,
      available: true,
      sku: null,
    },
  ],
  selectedVariantId: "variant_2",
  rating: { average: "4,5", count: 12, label: "5 üzerinden 4,5, 12 değerlendirme" },
  summaryHtml: null,
  summaryText: "Paslanmaz çelik.",
  quantity: true,
  needsPage: false,
}

const answer = (status: number, body: unknown) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })))

const settle = () =>
  act(async () => {
    await new Promise((done) => setTimeout(done, 30))
  })

function draw(card: ProductCardView, addToCart = vi.fn()) {
  act(() => {
    root.render(
      <>
        <ProductCard product={card} t={t} />
        <QuickViewHost
          setup={{ address: "/api/quick-view", addToCart }}
          words={quickViewWords(t)}
        />
      </>
    )
  })
}

const trigger = () => {
  const button = host.querySelector<HTMLButtonElement>("button[data-quick-view]")
  if (!button) {
    throw new Error("no quick view button")
  }
  return button
}

async function openDialog() {
  const button = trigger()
  act(() => {
    button.click()
  })
  // The dialog's code loads on the first look: wait for it, then for its answer
  for (let tries = 0; tries < 100 && !document.querySelector("[role=dialog]"); tries += 1) {
    await settle()
  }
  await settle()
  return button
}

describe("a card's quick view button", () => {
  it("is drawn only while the card carries it, beside the card's link, on every variant", () => {
    draw(CARD)
    expect(host.querySelector("button[data-quick-view]")).toBeNull()

    draw({ ...CARD, quickView: "hover" })
    const button = trigger()
    expect(button.dataset["quickView"]).toBe("hover")
    expect(button.getAttribute("aria-haspopup")).toBe("dialog")
    expect(button.getAttribute("aria-label")).toBe("Katlanır Çakı ürününe hızlı bak")
    expect(button.textContent).toBe("Hızlı bak")
    // The product's address stays the card's one link
    expect(host.querySelector('a[href="/urun/katlanir-caki"]')).not.toBeNull()
    expect(button.closest("a")).toBeNull()

    draw({ ...CARD, quickView: "icon" })
    expect(trigger().dataset["quickView"]).toBe("icon")
    expect(trigger().textContent).toBe("")

    draw({
      ...CARD,
      quickView: "hover",
      variant: "framed",
      framed: { secondImage: null, freeShipping: false, fullButton: false, buttonStyle: "outline" },
    })
    expect(host.querySelector(".gf-card-framed button[data-quick-view='hover']")).not.toBeNull()

    // The compact card: the icon only, at its row's end
    draw({ ...CARD, quickView: "hover", variant: "compact" })
    expect(trigger().dataset["quickView"]).toBe("inline")
    expect(trigger().textContent).toBe("")
    // Tezgâh audit of PR 31: in the shop's button shape (square there), and in the row a line, no shadow
    expect(trigger().classList).toContain("rounded-button")
    expect(trigger().classList).toContain("border-rule")
    expect(trigger().classList).not.toContain("shadow-float")
    // A compact card too narrow for its name, stars and price beside the icon draws none
    expect(trigger().classList).toContain("@max-[18rem]:hidden")
    expect(trigger().closest("article")?.classList).toContain("@container")
  })
})

describe("the quick view dialog", () => {
  it("opens on the card's name with a skeleton, asks the product once, then shows it", async () => {
    let release: (response: Response) => void = () => undefined
    const fetch = vi.fn(
      () =>
        new Promise<Response>((done) => {
          release = done
        })
    )
    vi.stubGlobal("fetch", fetch)
    draw({ ...CARD, quickView: "hover" })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    await openDialog()
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")
    expect(dialog).not.toBeNull()
    const title = document.getElementById(dialog?.getAttribute("aria-labelledby") ?? "")
    expect(title?.textContent).toBe("Katlanır Çakı")
    expect(dialog?.querySelector("[aria-busy=true]")?.textContent).toContain("Ürün yükleniyor")
    expect(fetch).toHaveBeenCalledWith("/api/quick-view?id=prod_01", expect.anything())

    await act(async () => {
      release(new Response(JSON.stringify(VIEW), { status: 200 }))
      await new Promise((done) => setTimeout(done, 10))
    })
    expect(dialog?.querySelector("[aria-busy=true]")).toBeNull()
    expect(dialog?.textContent).toContain("450,00 TL")
    expect(dialog?.textContent).toContain("Paslanmaz çelik.")
    expect(dialog?.textContent).toContain("Atölye")
    // The chosen variant's radio, the quantity field and the add button
    expect(dialog?.querySelector<HTMLInputElement>("input[value=Kahve]")?.checked).toBe(true)
    expect(dialog?.querySelector("input[name=quantity][type=number]")).not.toBeNull()
    expect(dialog?.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(false)
    expect(dialog?.querySelector('a[href="/urun/katlanir-caki"]')?.textContent).toBe(
      "Ürün sayfasına git"
    )
  })

  it("closes on Escape and gives the focus back to the card's button", async () => {
    vi.stubGlobal("fetch", answer(200, VIEW))
    draw({ ...CARD, quickView: "icon" })
    const button = await openDialog()
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")
    expect(dialog).not.toBeNull()
    await act(async () => {
      dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      await new Promise((done) => setTimeout(done, 20))
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it("offers the product's page when the answer fails or the product is gone", async () => {
    vi.stubGlobal("fetch", answer(502, { message: "quick_view.failed" }))
    draw({ ...CARD, quickView: "hover" })
    await openDialog()
    let dialog = document.querySelector<HTMLElement>("[role=dialog]")
    expect(dialog?.querySelector("[role=status]")?.textContent).toBe("Ürün şu an gösterilemiyor.")
    expect(dialog?.querySelector('a[href="/urun/katlanir-caki"]')).not.toBeNull()
    expect(dialog?.querySelector("button[type=submit]")).toBeNull()

    act(() => {
      root.unmount()
    })
    root = createRoot(host)
    vi.stubGlobal("fetch", answer(404, { message: "quick_view.not_found" }))
    draw({ ...CARD, id: "prod_02", quickView: "hover" })
    await openDialog()
    dialog = document.querySelector<HTMLElement>("[role=dialog]")
    expect(dialog?.querySelector("[role=status]")?.textContent).toBe("Bu ürün artık satışta değil.")
  })

  it("leaves the quantity out while the shop hides it, and adds one", async () => {
    vi.stubGlobal("fetch", answer(200, { ...VIEW, quantity: false }))
    draw({ ...CARD, quickView: "hover" })
    await openDialog()
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")
    expect(dialog?.querySelector("input[name=quantity][type=number]")).toBeNull()
    expect(
      dialog?.querySelector<HTMLInputElement>("input[name=quantity][type=hidden]")?.value
    ).toBe("1")
  })

  it("offers the product's page, not the button, for a product that asks more than the dialog sends", async () => {
    vi.stubGlobal("fetch", answer(200, { ...VIEW, needsPage: true }))
    draw({ ...CARD, quickView: "hover" })
    await openDialog()
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")
    expect(dialog?.querySelector("button[type=submit]")).toBeNull()
    expect(dialog?.querySelector("input[name=quantity][type=number]")).toBeNull()
    const links = dialog?.querySelectorAll('a[href="/urun/katlanir-caki"]') ?? []
    expect(links).toHaveLength(1)
    expect(links[0]?.textContent).toBe("Ürün sayfasına git")
  })

  it("closes once the line is in, and the cart drawer is told", async () => {
    vi.stubGlobal("fetch", answer(200, VIEW))
    const addToCart = vi.fn(() => Promise.resolve({ ok: true, error: null }))
    const told = vi.fn()
    window.addEventListener(CART_ADDED_EVENT, told)
    draw({ ...CARD, quickView: "hover" }, addToCart)
    const button = await openDialog()
    const submit = document.querySelector<HTMLButtonElement>("[role=dialog] button[type=submit]")
    await act(async () => {
      submit?.click()
      await new Promise((done) => setTimeout(done, 150))
    })
    expect(addToCart).toHaveBeenCalledTimes(1)
    const fields = (addToCart.mock.calls[0] as unknown as [unknown, FormData])[1]
    expect(fields.get("variant_id")).toBe("variant_2")
    expect(fields.get("quantity")).toBe("1")
    await settle()
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(told).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(button)
    window.removeEventListener(CART_ADDED_EVENT, told)
  })
})
