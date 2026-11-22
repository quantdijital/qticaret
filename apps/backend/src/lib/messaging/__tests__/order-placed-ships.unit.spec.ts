import { MESSAGE_TEMPLATES } from "../templates"
import type { Brand } from "../templates"

const brand: Brand = {
  shopName: "Örnek Mağaza",
  logoUrl: null,
  color: "#2f6feb",
  contactEmail: "destek@magaza.example",
  contactPhone: "+905321234567",
  storefrontUrl: null,
}

const orderPlaced = MESSAGE_TEMPLATES["order.placed"]
type OrderVars = typeof orderPlaced.sample

const emailOf = (vars: OrderVars) => {
  const render = orderPlaced.email
  if (!render) {
    throw new Error("order.placed has an e-mail")
  }
  return render(vars, brand)
}

/** adr/0076 §6: an order nothing ships for says no shipping and no delivery address. */
describe("order.placed for an order nothing ships for", () => {
  const sample: OrderVars = { ...orderPlaced.sample, payment: "card", bank: null }

  it("draws no shipping row and no delivery address", () => {
    const { html, text } = emailOf({ ...sample, ships: false })

    expect(text).not.toContain("Kargo")
    expect(text).not.toContain("Teslimat adresi")
    expect(text).not.toContain("Moda Mah.")
    expect(html).not.toContain("Teslimat adresi")
    // The rest of the summary stays
    expect(text).toContain("Örnek ürün")
    expect(text).toContain("₺389,80")
  })

  it("leaves a shipped order's e-mail exactly as it was, with the mark absent or true", () => {
    const before = emailOf(sample)

    expect(before.text).toContain("Kargo")
    expect(before.text).toContain("Teslimat adresi")
    expect(before.text).toContain("Moda Mah.")
    expect(emailOf({ ...sample, ships: true })).toEqual(before)
  })
})
