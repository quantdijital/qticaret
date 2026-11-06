import { describe, expect, it } from "vitest"
import type { PriceDisplay, StoreProduct } from "@qticaret/types"
import { eventOf } from "../client"
import { ga4Event } from "../events"
import {
  checkoutEvents,
  listContext,
  listEvent,
  listItems,
  productEvents,
  purchaseEvent,
} from "../payloads"

const product = {
  id: "prod_1",
  title: "Keten gömlek",
  handle: "keten-gomlek",
  subtitle: null,
  description: null,
  thumbnail: null,
  brand: { id: "brand_1", name: "Marka", handle: "marka", logo_url: null },
  variants: [
    {
      id: "variant_s",
      title: "S",
      sku: null,
      manage_inventory: false,
      allow_backorder: false,
      calculated_price: { calculated_amount: 899.9 },
    },
    {
      id: "variant_m",
      title: "M",
      sku: null,
      manage_inventory: false,
      allow_backorder: false,
      calculated_price: { calculated_amount: 799.9 },
    },
  ],
} as unknown as StoreProduct

const display = (current: string, before: string | null = null): PriceDisplay => ({
  current,
  regular: before ?? current,
  before,
  on_sale: before !== null,
  since: null,
  basis: before ? "history" : null,
  rule_version: "tr-10d-1",
  cart_offer: null,
})

// The shop's 30% automatic promotion every shopper gets, as the backend's display reads it
// (adr/0023 Ek 2026-11-05): what the page shows, not Medusa's calculated price
const promoted = {
  variant_s: display("629.93", "899.90"),
  variant_m: display("559.93", "799.90"),
}

describe("the pages' events", () => {
  it("views the variant shown, and keeps every variant for the theme's 'added to cart'", () => {
    const { events, context } = productEvents(product, "variant_m", {})
    expect(events).toEqual([
      {
        name: "view_item",
        value: 799.9,
        items: [
          {
            id: "variant_m",
            name: "Keten gömlek",
            price: 799.9,
            quantity: 1,
            brand: "Marka",
            variant: "M",
          },
        ],
      },
    ])
    expect(Object.keys(context.items ?? {})).toEqual(["variant_s", "variant_m"])
    expect(productEvents(product, null, {}).events[0]).toMatchObject({ value: 899.9 })
  })

  it("sends the promoted price the page shows to view_item, its variants' facts kept for the cart", () => {
    const { events, context } = productEvents(product, "variant_m", promoted)
    expect(events[0]).toMatchObject({
      name: "view_item",
      value: 559.93,
      items: [{ id: "variant_m", price: 559.93 }],
    })
    expect(ga4Event(events[0] as never)[1]).toMatchObject({
      value: 559.93,
      items: [{ item_id: "variant_m", price: 559.93 }],
    })
    // The cart's own look counts the add (`watchCart`); the page lends it the variant's brand
    expect(context.items?.["variant_s"]).toMatchObject({ price: 629.93, brand: "Marka" })
    expect(
      eventOf({ type: "add_to_cart", variantId: "variant_s", quantity: 2 }, context)
    ).toBeNull()
  })

  it("maps each card's path to the list's item at its place, for select_item", () => {
    const other: StoreProduct = { ...product, id: "prod_2", title: "Pamuk gömlek" }
    const event = listEvent("product_category", "Gömlekler", [product, other], {})
    const list = listContext(event, { prod_1: "/keten-gomlek", prod_2: "/pamuk-gomlek?x=1" })
    expect(list).toMatchObject({ id: "product_category", name: "Gömlekler" })
    expect(Object.keys(list.links)).toEqual(["/keten-gomlek", "/pamuk-gomlek"])
    expect(list.links["/keten-gomlek"]).toMatchObject({ id: "prod_1", index: 0 })
    expect(list.links["/pamuk-gomlek"]).toMatchObject({ id: "prod_2", index: 1 })
    // A product with no page of its own has no card
    const fewer = listContext(event, { prod_2: "/pamuk-gomlek" }).links
    expect(Object.keys(fewer)).toEqual(["/pamuk-gomlek"])
    expect(fewer["/pamuk-gomlek"]).toMatchObject({ id: "prod_2", index: 1 })
  })

  it("lists each product once at its lowest shown price; a category's name is the items' category", () => {
    const event = listEvent("product_category", "Gömlekler", [product], {})
    expect(event).toEqual({
      name: "view_item_list",
      listId: "product_category",
      listName: "Gömlekler",
      items: [
        {
          id: "prod_1",
          name: "Keten gömlek",
          price: 799.9,
          quantity: 1,
          brand: "Marka",
          category: "Gömlekler",
        },
      ],
    })
    expect(listEvent("search", "Arama", [product], {}).items[0]).not.toHaveProperty("category")
    expect(listEvent("sale", "Kampanyalı ürünler", [product], promoted).items[0]).toMatchObject({
      price: 559.93,
    })
  })

  it("keeps a list's quick-add variants at their shown price for 'added to cart'", () => {
    const items = listItems([product], { variant_m: promoted.variant_m }, ["variant_m"])
    expect(Object.keys(items)).toEqual(["variant_m"])
    expect(items["variant_m"]).toMatchObject({ price: 559.93, quantity: 1 })
    expect(listItems([product], promoted, [])).toEqual({})
  })

  it("begins the checkout with the cart's items after discounts", () => {
    const { events, context } = checkoutEvents({
      item_total: 1599.8,
      items: [
        {
          variant_id: "variant_m",
          product_title: "Keten gömlek",
          title: "M",
          variant_title: "M",
          unit_price: 799.9,
          total: 1599.8,
          quantity: 2,
        },
      ],
    })
    expect(events[0]).toMatchObject({ name: "begin_checkout", value: 1599.8 })
    expect(context.checkout?.items[0]).toMatchObject({ id: "variant_m", quantity: 2, price: 799.9 })
  })

  it("prices a checkout line as the cart charges it, the automatic promotion taken off", () => {
    // 2 × 799,90 with 30% off: the line's total is the server's, per unit 559,93
    const { events } = checkoutEvents({
      item_total: 1119.86,
      items: [
        {
          variant_id: "variant_m",
          product_title: "Keten gömlek",
          title: "M",
          unit_price: 799.9,
          total: 1119.86,
          quantity: 2,
        },
        // A line without its total falls back to its unit price
        { variant_id: "variant_s", title: "S", unit_price: 899.9, quantity: 1 },
      ],
    })
    expect(events[0]).toMatchObject({
      value: 1119.86,
      items: [
        { id: "variant_m", price: 559.93, quantity: 2 },
        { id: "variant_s", price: 899.9, quantity: 1 },
      ],
    })
  })

  it("names the purchase by the order's id, its total and shipping as the server's event does", () => {
    expect(
      purchaseEvent({
        id: "order_1",
        total: 1689.8,
        shipping_total: 90,
        items: [
          {
            variant_id: "variant_m",
            product_title: "Keten gömlek",
            title: "M",
            unit_price: 799.9,
            quantity: 2,
          },
        ],
      })
    ).toEqual({
      name: "purchase",
      transactionId: "order_1",
      value: 1689.8,
      shipping: 90,
      items: [
        {
          id: "variant_m",
          name: "Keten gömlek",
          price: 799.9,
          quantity: 2,
          variant: null,
        },
      ],
    })
  })
})
