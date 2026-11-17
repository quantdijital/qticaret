import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as Client from "../client"
import type { CartSnapshot } from "../cart-changes"
import { NO_CART, cartChanges, snapshotOf } from "../cart-changes"
import { cartSnapshotOf, shippingInfoEvents, viewCartEvents } from "../cart-payloads"
import { fakeBrowser, ga4Events, metaCalls } from "../../../test/fake-browser"

const shirt = { id: "variant_m", name: "Keten gömlek", price: 559.93, quantity: 1 }
const cup = { id: "variant_c", name: "Kupa", price: 100, quantity: 2 }

const cart = (items: CartSnapshot["items"], id = "cart_1", locked = false): CartSnapshot => ({
  id,
  locked,
  items,
})

describe("what changed in the cart", () => {
  it("tells units added at today's price and units taken out at the price they had", () => {
    expect(cartChanges(cart([shirt, cup]), cart([{ ...shirt, quantity: 3, price: 500 }]))).toEqual([
      {
        name: "add_to_cart",
        value: 1000,
        items: [{ ...shirt, price: 500, quantity: 2 }],
      },
      { name: "remove_from_cart", value: 200, items: [cup] },
    ])
    expect(cartChanges(cart([shirt]), cart([shirt]))).toEqual([])
  })

  it("counts a new cart's lines as added only after a look that saw no cart", () => {
    expect(cartChanges(NO_CART, cart([shirt]))).toEqual([
      { name: "add_to_cart", value: 559.93, items: [shirt] },
    ])
    // No earlier look, another cart (restored, a link's), a link's cart, or the cart gone
    expect(cartChanges(undefined, cart([shirt]))).toEqual([])
    expect(cartChanges(cart([], "cart_0"), cart([shirt]))).toEqual([])
    expect(cartChanges(NO_CART, cart([shirt], "cart_1", true))).toEqual([])
    expect(cartChanges(cart([shirt], "cart_1", true), cart([]))).toEqual([])
    expect(cartChanges(cart([shirt]), NO_CART)).toEqual([])
  })

  it("reads back only a well-formed kept look", () => {
    expect(snapshotOf(cart([shirt]))).toEqual(cart([shirt]))
    expect(snapshotOf({ id: "cart_1", locked: false, items: [{ id: 1 }] })).toBeUndefined()
    expect(snapshotOf({ id: null, locked: false, items: [] })).toBeUndefined()
    expect(snapshotOf("x")).toBeUndefined()
  })
})

describe("the cart's events from the server's cart", () => {
  const facts = {
    id: "cart_1",
    item_total: 1219.86,
    items: [
      // Two lines of one variant (different add-on picks), one at 30% off
      {
        variant_id: "variant_m",
        title: "Keten gömlek",
        unit_price: 799.9,
        total: 1119.86,
        quantity: 2,
      },
      { variant_id: "variant_m", title: "Keten gömlek", unit_price: 799.9, total: 0, quantity: 1 },
      { variant_id: "variant_c", title: "Kupa", unit_price: 100, total: 100, quantity: 1 },
    ],
    shipping_methods: [{ shipping_option_id: "so_1", name: "Aras Kargo" }],
  }

  it("keeps the cart by variant at the price the cart charges, a payment link's marked", () => {
    expect(cartSnapshotOf(facts)).toEqual({
      id: "cart_1",
      locked: false,
      items: [
        expect.objectContaining({ id: "variant_m", quantity: 3, price: 373.29 }),
        expect.objectContaining({ id: "variant_c", quantity: 1, price: 100 }),
      ],
    })
    expect(cartSnapshotOf({ ...facts, metadata: { qt_payment_link: "pl_1" } }).locked).toBe(true)
    expect(cartSnapshotOf(null)).toBe(NO_CART)
  })

  it("views the cart and tells the shipping chosen, each with the cart's own prices", () => {
    expect(viewCartEvents(facts)).toEqual([
      {
        name: "view_cart",
        value: 1219.86,
        items: [
          expect.objectContaining({ id: "variant_m", price: 559.93, quantity: 2 }),
          expect.objectContaining({ id: "variant_m", price: 0, quantity: 1 }),
          expect.objectContaining({ id: "variant_c", price: 100, quantity: 1 }),
        ],
      },
    ])
    expect(viewCartEvents({ ...facts, items: [] })).toEqual([])
    expect(viewCartEvents(null)).toEqual([])
    expect(shippingInfoEvents(facts)).toEqual([
      expect.objectContaining({
        name: "add_shipping_info",
        shippingTier: "Aras Kargo",
        value: 1219.86,
      }),
    ])
    expect(shippingInfoEvents({ ...facts, shipping_methods: [] })).toEqual([])
  })
})

describe("the cart and the cards in the browser", () => {
  let client: typeof Client

  beforeEach(async () => {
    vi.resetModules()
    client = await import("../client")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("watches nothing and keeps nothing for a visitor who allowed no tag", () => {
    const { storage } = fakeBrowser()
    client.configureAnalytics({ ga4: null, meta: null, adSignals: false, amounts: true }, undefined)
    client.watchCart(NO_CART)
    client.watchCart(cart([shirt]))
    expect(storage.size).toBe(0)
  })

  it("tells what went in or out between the frame's looks, to GA4 and Meta, with the page's brand", () => {
    const { win } = fakeBrowser()
    client.configureAnalytics(
      { ga4: "G-ABC123", meta: "1234567890", adSignals: true, amounts: true },
      undefined
    )
    client.setPageContext({ items: { variant_m: { ...shirt, brand: "Marka" } } })
    client.watchCart(NO_CART)
    client.watchCart(cart([shirt]))
    client.watchCart(cart([{ ...shirt, quantity: 2 }]))
    client.watchCart(cart([]))
    expect(ga4Events(win).map(([name, params]) => [name, params["value"]])).toEqual([
      ["add_to_cart", 559.93],
      ["add_to_cart", 559.93],
      ["remove_from_cart", 1119.86],
    ])
    expect(ga4Events(win)[0]?.[1]["items"]).toEqual([
      expect.objectContaining({ item_id: "variant_m", item_brand: "Marka", quantity: 1 }),
    ])
    expect(
      metaCalls(win)
        .filter((call) => call[0] === "track")
        .map((call) => call[1])
    ).toEqual(["AddToCart", "AddToCart"])
  })

  it("takes another tab's later look at the same cart, so nothing is told twice", async () => {
    const { win } = fakeBrowser()
    client.configureAnalytics(
      { ga4: "G-ABC123", meta: null, adSignals: false, amounts: true },
      undefined
    )
    client.watchCart(cart([shirt]))
    // Another tab (another page's memory, the same browser) adds a cup and sees it
    vi.resetModules()
    const other = await import("../client")
    other.configureAnalytics(
      { ga4: "G-ABC123", meta: null, adSignals: false, amounts: true },
      undefined
    )
    other.watchCart(cart([shirt]))
    other.watchCart(cart([shirt, cup]))
    // This tab refreshes and sees the cup too: already told
    client.watchCart(cart([shirt, cup]))
    expect(ga4Events(win).map(([name]) => name)).toEqual(["add_to_cart"])
  })

  it("starts from a first look at a cart it never saw (a restored cart is not an add)", () => {
    const { win } = fakeBrowser()
    client.configureAnalytics(
      { ga4: "G-ABC123", meta: null, adSignals: false, amounts: true },
      undefined
    )
    client.watchCart(cart([shirt, cup], "cart_9"))
    expect(ga4Events(win)).toEqual([])
  })

  it("tells the card chosen from the page's list, and nothing for any other link", () => {
    const { win } = fakeBrowser("https://shop.test/gomlekler")
    client.configureAnalytics(
      { ga4: "G-ABC123", meta: null, adSignals: false, amounts: true },
      undefined
    )
    const list = {
      id: "product_category",
      name: "Gömlekler",
      links: {
        "/keten-gomlek": { id: "prod_1", name: "Keten gömlek", price: 10, quantity: 1, index: 3 },
      },
    }
    const link = (href: string) => ({ closest: () => ({ href }) }) as unknown as EventTarget
    expect(client.selectionOf(link("https://shop.test/keten-gomlek?variant=v"))).toBeNull()
    client.setPageContext({ list })
    const chosen = client.selectionOf(link("https://shop.test/keten-gomlek?variant=v"))
    expect(chosen).toEqual({
      name: "select_item",
      listId: "product_category",
      listName: "Gömlekler",
      items: [list.links["/keten-gomlek"]],
    })
    expect(client.selectionOf(link("https://shop.test/sepet"))).toBeNull()
    expect(client.selectionOf(link("https://other.test/keten-gomlek"))).toBeNull()
    expect(client.selectionOf({ closest: () => null } as unknown as EventTarget)).toBeNull()
    client.track(chosen as never)
    expect(ga4Events(win)[0]?.[1]).toMatchObject({
      item_list_id: "product_category",
      items: [expect.objectContaining({ item_id: "prod_1", index: 3 })],
    })
  })
})
