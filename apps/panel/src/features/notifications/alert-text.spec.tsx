import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AI_SERVICE_IDS } from "@/features/ai/services"
import { i18next } from "@/lib/i18n"
import { useAlertText } from "./alert-text"

const account = (provider: string) =>
  renderHook(() => useAlertText({ kind: "provider_account", provider, changes: ["connected"] }))
    .result.current

describe("the bell's account alert for an AI service (adr/0071 §3)", () => {
  afterEach(async () => {
    await i18next.changeLanguage("tr")
  })

  it("names every AI service by its shown name, never its id", async () => {
    const names = {
      deepseek: "DeepSeek",
      minimax: "MiniMax",
      gemini: "Gemini",
      photoroom: "Photoroom",
      bria: "Bria",
    }
    for (const lng of ["tr", "en"]) {
      await i18next.changeLanguage(lng)
      for (const [id, name] of Object.entries(names)) {
        const { title, link } = account(id)
        expect(title).toContain(name)
        expect(title).not.toContain(id)
        expect(link?.to).toBe("/settings/ai")
      }
    }
  })

  it("has a shown name for each service the panel knows", () => {
    for (const lng of ["tr", "en"]) {
      for (const id of AI_SERVICE_IDS) {
        expect(i18next.exists(`ai.services.${id}.name`, { lng })).toBe(true)
      }
    }
  })

  it("still shows a service the panel does not know yet, by its id", () => {
    expect(account("acme").title).toBe("acme hesap bilgileri değişti")
  })
})

describe("the bell's contact alert (adr/0047; adr/0076 Ek 2026-11-23)", () => {
  const alert = (data: Record<string, unknown>) =>
    renderHook(() => useAlertText({ kind: "contact_message", ...data })).result.current

  it("says a booking request's product, dates and people as the server worded them", () => {
    const { title, description, link } = alert({
      subject: "booking",
      title: "Rezervasyon talebi: Kapadokya turu",
      description: "Rezervasyon talebi: Kapadokya turu, Mart 2027, 2 yetişkin.",
    })
    expect(title).toBe("Rezervasyon talebi: Kapadokya turu")
    expect(description).toContain("Mart 2027, 2 yetişkin")
    expect(link?.to).toBe("/customers/contact-messages")
  })

  it("words any other message from its subject alone", () => {
    const { title } = alert({ subject: "order", description: "Ayşe yazdı" })
    expect(title).toContain("Sipariş")
    expect(title).not.toContain("Ayşe")
  })
})

describe("the bell's low-stock alert (F3.8, adr/0020)", () => {
  const alert = (data: Record<string, unknown>) =>
    renderHook(() => useAlertText({ kind: "low_stock", available: 2, threshold: 5, ...data }))
      .result.current

  it("names the product and variant and opens the product", () => {
    const { title, description, link } = alert({
      name: "Sürmene Şef Bıçağı — Kahve",
      product_id: "prod_01",
      inventory_item_id: "iitem_01M7TVZ5MN516RSJ9991Z77SZ6",
    })
    expect(title).toBe("Stok azalıyor: Sürmene Şef Bıçağı — Kahve")
    expect(description).toBe("2 adet kaldı (eşik 5).")
    expect(link).toEqual({ to: "/products/$id", search: {}, params: { id: "prod_01" } })
  })

  it("reads an old alert that stored the item's id, or no name, as a product", () => {
    for (const name of ["iitem_01M7TVZ5MN516RSJ9991Z77SZ6", "", undefined]) {
      const { title, link } = alert({ name })
      expect(title).toBe("Stok azalıyor: bir ürün")
      expect(link).toEqual({ to: "/inventory", search: { view: "low" }, params: {} })
    }
  })
})

describe("the bell's words never show a record's id", () => {
  it("names an order refund's order by its number, or as this order", () => {
    const issue = (data: Record<string, unknown>) =>
      renderHook(() =>
        useAlertText({
          kind: "payment_issue",
          issue: "refund_unresolved",
          provider: "paytr",
          reference: "Rpayses01ABC",
          cart_id: "order_01M7TVZ5MN516RSJ9991Z77SZ6",
          amount: 21000,
          ...data,
        })
      ).result.current
    expect(issue({ order_number: "1042" }).description).toMatch(/^#1042 siparişi için/)
    const old = issue({})
    expect(old.description).toMatch(/^Bu sipariş için/)
    expect(old.description).not.toContain("order_01")
    expect(old.link?.params).toEqual({ id: "order_01M7TVZ5MN516RSJ9991Z77SZ6" })
  })

  it("takes ids out of the server's own text for an alert it does not word", () => {
    const { title, description } = renderHook(() =>
      useAlertText({
        kind: "payment_recovery",
        title: "PayTR ödemesi iade edilmedi: siparişi var",
        description:
          "210,00 TRY (payses01ABC) iade listesine yazılmıştı, ancak sipariş order_01M7TVZ5MN516RSJ9991Z77SZ6 bu ödemeyle açılmış.",
      })
    ).result.current
    expect(title).toBe("PayTR ödemesi iade edilmedi: siparişi var")
    expect(description).toContain("payses01ABC")
    expect(description).not.toContain("order_01")
  })
})
