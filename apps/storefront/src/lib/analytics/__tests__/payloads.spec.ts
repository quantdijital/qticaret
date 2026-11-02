import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { checkoutEvents, listEvent, productEvents, purchaseEvent } from "../payloads"

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

describe("the pages' events", () => {
  it("views the variant shown, and keeps every variant for the theme's 'added to cart'", () => {
    const { events, context } = productEvents(product, "variant_m")
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
    expect(productEvents(product, null).events[0]).toMatchObject({ value: 899.9 })
  })

  it("lists each product once at its lowest price; a category's name is the items' category", () => {
    const event = listEvent("product_category", "Gömlekler", [product])
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
    expect(listEvent("search", "Arama", [product]).items[0]).not.toHaveProperty("category")
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
          quantity: 2,
        },
      ],
    })
    expect(events[0]).toMatchObject({ name: "begin_checkout", value: 1599.8 })
    expect(context.checkout?.items[0]).toMatchObject({ id: "variant_m", quantity: 2 })
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
