import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import type { ShopMarkView, TrustBadgeView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { deliveryFacts, productShipping } from "../product-shipping"
import type { ProductShippingInput } from "../product-shipping"

/*
 * The product page's "Kargo ve Teslimat" card (owner 2026-11-05): only
 * what the shop set and wrote. The free shipping threshold in the shop's
 * own words when one of its lines names it, when an order leaves and
 * arrives from its settings (else its own delivery lines), its return
 * promise, the law's return window when it wrote none, its carriers and
 * pages; nothing for a product that is not shipped.
 */

const product = (extension: StoreProduct["product_extension"] = null): StoreProduct => ({
  id: "prod_1",
  title: "Çakı",
  handle: "caki",
  subtitle: null,
  description: null,
  thumbnail: null,
  product_extension: extension,
})

const BADGES: TrustBadgeView[] = [
  { icon: "truck", title: "Ücretsiz kargo", text: "₺1.500 ve üzeri" },
  { icon: "clock", title: "Aynı gün kargo", text: "Hafta içi 16:00'a kadar" },
  { icon: "award", title: "2 yıl garanti", text: "Marka garantili ürünler" },
  { icon: "shield", title: "Güvenli ödeme", text: "Kart veya havale/EFT" },
]

const ARAS: ShopMarkView = { key: "aras", label: "Aras Kargo", logo: null }

const input = (over: Partial<ProductShippingInput> = {}): ProductShippingInput => ({
  product: product(),
  threshold: 1500,
  badges: BADGES,
  carriers: [ARAS],
  shippingPath: "/kargo-ve-teslimat",
  returnPolicy: { label: "İade ve Değişim Politikası", path: "/yasal/iade-politikasi" },
  t,
  ...over,
})

describe("the product's shipping card", () => {
  it("tells the shop's delivery promises, the return window, its carriers and pages", () => {
    expect(productShipping(input())).toEqual({
      facts: [
        { icon: "truck", title: "Ücretsiz kargo", text: "₺1.500 ve üzeri" },
        { icon: "clock", title: "Aynı gün kargo", text: "Hafta içi 16:00'a kadar" },
        { icon: "refresh", title: "14 gün içinde iade", text: "Anlaşmalı kargoyla iade ücretsiz" },
      ],
      carriers: [ARAS],
      links: [
        { label: "Kargo ve teslimat ayrıntıları", path: "/kargo-ve-teslimat" },
        { label: "İade ve Değişim Politikası", path: "/yasal/iade-politikasi" },
      ],
    })
  })

  it("says the threshold itself when no line of the shop names it", () => {
    const card = productShipping(
      input({ badges: [{ icon: "truck", title: "Hızlı kargo", text: "1-3 iş günü" }] })
    )
    expect(card?.facts.slice(0, 2)).toEqual([
      { icon: "truck", title: "Ücretsiz kargo", text: "1.500,00 TL ve üzeri siparişlerde" },
      { icon: "truck", title: "Hızlı kargo", text: "1-3 iş günü" },
    ])
    // A threshold written "1.500,00 TL" is the same amount
    const named = productShipping(
      input({ badges: [{ icon: "truck", title: "1.500,00 TL üzeri kargo bedava", text: null }] })
    )
    expect(named?.facts[0]).toEqual({
      icon: "truck",
      title: "1.500,00 TL üzeri kargo bedava",
      text: null,
    })
    expect(named?.facts).toHaveLength(2)
  })

  it("promises no free shipping without a threshold, and keeps the shop's own return line", () => {
    const card = productShipping(
      input({
        threshold: null,
        badges: [{ icon: "refresh", title: "30 gün içinde iade", text: "Koşulsuz" }],
        carriers: [],
        shippingPath: null,
        returnPolicy: null,
      })
    )
    expect(card).toEqual({
      facts: [{ icon: "refresh", title: "30 gün içinde iade", text: "Koşulsuz" }],
      carriers: [],
      links: [],
    })
  })

  it("says a sealed good returns unopened", () => {
    const card = productShipping(input({ product: product({ withdrawal_excluded: true }) }))
    expect(card?.facts.at(-1)).toEqual({
      icon: "refresh",
      title: "14 gün içinde iade",
      text: "Ambalajı açılmamış üründe; anlaşmalı kargoyla ücretsiz",
    })
  })

  it("says when it leaves and arrives from the shop's settings, in place of its own delivery lines", () => {
    const card = productShipping(
      input({
        delivery: {
          handling_days: { min: 1, max: 2 },
          transit_days: { min: 1, max: 3 },
          same_day_cutoff_hour: null,
        },
      })
    )
    expect(card?.facts).toEqual([
      { icon: "truck", title: "Ücretsiz kargo", text: "₺1.500 ve üzeri" },
      { icon: "truck", title: "1–2 iş gününde kargoda", text: "Tahmini teslimat 2–5 iş günü" },
      { icon: "refresh", title: "14 gün içinde iade", text: "Anlaşmalı kargoyla iade ücretsiz" },
    ])
  })

  it("adds the same-day hour when the shop promises one, its ending as the hour reads", () => {
    const facts = (hour: number, handling = { min: 0, max: 0 }) =>
      deliveryFacts(
        { handling_days: handling, transit_days: { min: 1, max: 2 }, same_day_cutoff_hour: hour },
        t
      )
    expect(facts(15)).toEqual([
      { icon: "truck", title: "Aynı gün kargoda", text: "Tahmini teslimat 1–2 iş günü" },
      {
        icon: "clock",
        title: "Saat 15.00'e kadar verilen siparişler aynı gün kargoda",
        text: null,
      },
    ])
    expect(facts(16)[1]?.title).toBe("Saat 16.00'ya kadar verilen siparişler aynı gün kargoda")
    expect(facts(12)[1]?.title).toContain("12.00'ye kadar")
    expect(facts(10)[1]?.title).toContain("10.00'a kadar")
    expect(facts(19)[1]?.title).toContain("19.00'a kadar")
    expect(facts(20)[1]?.title).toContain("20.00'ye kadar")
    // One day to leave, said once
    expect(facts(14, { min: 1, max: 1 })[0]?.title).toBe("1 iş gününde kargoda")
  })

  it("draws no card for a product that is not shipped", () => {
    expect(productShipping(input({ product: product({ kind: "digital" }) }))).toBeNull()
    expect(productShipping(input({ product: product({ kind: "service" }) }))).toBeNull()
    expect(productShipping(input({ product: product({ is_gift_card: true }) }))).toBeNull()
  })
})
