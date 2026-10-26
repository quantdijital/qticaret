import { NOTIFICATION_MESSAGES, notificationText } from "../messages"

describe("notification messages", () => {
  it("have the same keys and placeholders in Turkish and English", () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
    expect(Object.keys(NOTIFICATION_MESSAGES.en).sort()).toEqual(
      Object.keys(NOTIFICATION_MESSAGES.tr).sort()
    )
    for (const [key, tr] of Object.entries(NOTIFICATION_MESSAGES.tr)) {
      const en = NOTIFICATION_MESSAGES.en[key]
      expect(placeholders(en?.title ?? "")).toEqual(placeholders(tr.title))
      expect(placeholders(en?.description ?? "")).toEqual(placeholders(tr.description))
    }
  })

  it("fills in the alert's values, in the shop's language by default", () => {
    expect(
      notificationText("stock.low_stock", { name: "Kupa · Beyaz", available: 2, threshold: 5 })
    ).toEqual({ title: "Düşük stok: Kupa · Beyaz", description: "2 adet kaldı (eşik 5)." })
    expect(
      notificationText("stock.low_stock", { name: "Mug", available: 0, threshold: 3 }, "en")
    ).toEqual({ title: "Low stock: Mug", description: "0 left (threshold 3)." })
  })

  it("leaves a missing value's placeholder, and reads an unknown key as itself", () => {
    expect(notificationText("stock.low_stock", { name: "Kupa" }).description).toBe(
      "{{available}} adet kaldı (eşik {{threshold}})."
    )
    expect(notificationText("stock.unknown", {})).toEqual({
      title: "stock.unknown",
      description: "",
    })
  })
})
