import { MESSAGE_TEMPLATES } from "../templates"
import type { Brand, OrderVars } from "../templates"

const brand: Brand = {
  shopName: "Örnek Mağaza",
  logoUrl: null,
  color: "#2f6feb",
  contactEmail: null,
  contactPhone: null,
  storefrontUrl: "https://magaza.example",
}

const plain = { title: "Örnek ürün", detail: "Mavi / M", quantity: 2 }
const picked = {
  title: "İkinci ürün",
  detail: null,
  quantity: 1,
  addons: [
    { label: "Ürün üzerine yazı", value: "Ada <b>Yılmaz</b>", amount: "₺35,00" },
    { label: "Kılıf", value: "Desenli Siyah", amount: "₺300,00" },
    { label: "Hediye notu", value: "İyi ki doğdun", amount: null },
  ],
  nonWithdrawable: true,
}

const order = (items: OrderVars["items"]): OrderVars => ({
  ...MESSAGE_TEMPLATES["order.placed"].sample,
  items,
})

/** adr/0052 §9: a line's add-on picks under it, and the note a personal product carries. */
describe("order messages with add-on picks", () => {
  it("prints each pick under its line with its price, a free one without, and the note", () => {
    const mail = MESSAGE_TEMPLATES["order.placed"].email?.(
      order([
        { ...plain, total: "₺240,00" },
        { ...picked, total: "₺1.335,00" },
      ]),
      brand
    )

    expect(mail?.text).toContain(
      [
        "1 × İkinci ürün: ₺1.335,00",
        "  Ürün üzerine yazı: Ada <b>Yılmaz</b> (+₺35,00)",
        "  Kılıf: Desenli Siyah (+₺300,00)",
        "  Hediye notu: İyi ki doğdun",
        "  Kişiye özel ürün: cayma hakkı yok",
      ].join("\n")
    )
    // The shopper's typed text is escaped in the HTML
    expect(mail?.html).toContain("Ürün üzerine yazı: Ada &lt;b&gt;Yılmaz&lt;/b&gt; (+₺35,00)")
    expect(mail?.html).not.toContain("<b>Yılmaz</b>")
    expect(mail?.html).toContain("Hediye notu: İyi ki doğdun<")
    expect(mail?.html).toContain("Kişiye özel ürün: cayma hakkı yok")
  })

  it("prints a line without picks as before, with no note", () => {
    const mail = MESSAGE_TEMPLATES["order.placed"].email?.(
      order([{ ...plain, total: "₺240,00" }]),
      brand
    )

    expect(mail?.text).toContain("2 × Örnek ürün (Mavi / M): ₺240,00\n")
    expect(mail?.text).not.toContain("cayma hakkı")
    expect(mail?.html).not.toContain("cayma hakkı")
  })

  it("leaves the SMS as it was", () => {
    const sms = MESSAGE_TEMPLATES["order.placed"].sms
    expect(sms?.(order([{ ...picked, total: "₺1.335,00" }]), brand)).toBe(
      sms?.(order([{ ...plain, total: "₺1.335,00" }]), brand)
    )
  })

  it("lists a parcel's and a return's lines with their picks, without prices", () => {
    const shipped = MESSAGE_TEMPLATES["order.shipped"]
    const delivered = MESSAGE_TEMPLATES["order.delivered"]
    const requested = MESSAGE_TEMPLATES["return.requested"]
    const parcel = { ...shipped.sample, items: [plain, picked] }
    const lines = [
      "1 × İkinci ürün",
      "Ürün üzerine yazı: Ada <b>Yılmaz</b>",
      "Kılıf: Desenli Siyah",
      "Hediye notu: İyi ki doğdun",
      "Kişiye özel ürün: cayma hakkı yok",
    ].join("\n")

    expect(shipped.email?.(parcel, brand).text).toContain(lines)
    expect(delivered.email?.(parcel, brand).text).toContain(lines)
    expect(requested.email?.({ ...requested.sample, items: [picked] }, brand).text).toContain(lines)
    expect(shipped.email?.(parcel, brand).text).not.toContain("(+₺")
    expect(shipped.email?.({ ...parcel, items: [plain] }, brand).text).not.toContain("cayma")
    expect(shipped.sms?.(parcel, brand)).toBe(shipped.sms?.({ ...parcel, items: [plain] }, brand))
  })
})
