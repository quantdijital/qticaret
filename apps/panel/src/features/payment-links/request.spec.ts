import { describe, expect, it, vi } from "vitest"
import { EMPTY_FORM, discountNumber, linkFormSchema } from "./form"
import type { LinkFormValues } from "./form"
import { VARIANT_A, link } from "./payment-links.fixtures"
import { previewOf, requestOf, valuesFromLink } from "./request"

// The fixtures name the staff's queries; nothing here talks to the API
vi.mock("@/lib/sdk", () => ({ sdk: {} }))

const form = (more: Partial<LinkFormValues> = {}): LinkFormValues => ({
  ...EMPTY_FORM,
  customerMode: "guest",
  guest: { first_name: " Ayşe ", last_name: "Yılmaz", email: "ayse@example.com", phone: "" },
  lines: [{ variant_id: VARIANT_A, label: "Şef bıçağı", quantity: 2 }],
  ...more,
})

const ADDRESS = {
  deliver: true,
  recipient_first: "Ayşe",
  recipient_last: "Yılmaz",
  address_1: "Atatürk Cad. No: 5",
  address_2: "Moda Mah.",
  province: "İstanbul",
  city: "Kadıköy",
  postal_code: "34710",
  phone: "",
  shipping_option_id: "so_01JS000000000000000000SSS",
}

const issues = (values: LinkFormValues) =>
  (linkFormSchema.safeParse(values).error?.issues ?? []).map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))

describe("the new-order form's requests (adr/0051)", () => {
  it("sends a guest without an empty phone, the lines and the hours; never a price", () => {
    expect(requestOf(form(), true)).toEqual({
      guest: { first_name: "Ayşe", last_name: "Yılmaz", email: "ayse@example.com" },
      lines: [{ variant_id: VARIANT_A, quantity: 2 }],
      expires_in_hours: 72,
    })
  })

  it("sends a known customer by id alone, with the address and its shipping option", () => {
    const values = form({
      customerMode: "existing",
      customer: { id: "cus_1", label: "x" },
      ...ADDRESS,
    })
    expect(requestOf(values, true)).toEqual({
      customer_id: "cus_1",
      lines: [{ variant_id: VARIANT_A, quantity: 2 }],
      address: {
        first_name: "Ayşe",
        last_name: "Yılmaz",
        address_1: "Atatürk Cad. No: 5",
        address_2: "Moda Mah.",
        province: "İstanbul",
        city: "Kadıköy",
        postal_code: "34710",
      },
      shipping_option_id: "so_01JS000000000000000000SSS",
      expires_in_hours: 72,
    })
  })

  it("drops a shipping option without an address (the backend wants both)", () => {
    const values = form({ shipping_option_id: "so_01JS000000000000000000SSS" })
    expect(requestOf(values, true)).not.toHaveProperty("shipping_option_id")
    expect(previewOf(values, true)).not.toHaveProperty("shipping_option_id")
  })

  it("turns a lira discount into kuruş, and sends none for a role that cannot give one", () => {
    const values = form({
      discountOn: true,
      discountType: "fixed",
      discountValue: "1.250,50",
      discountReason: "Hasarlı kutu",
    })
    expect(requestOf(values, true).discount).toEqual({
      type: "fixed",
      value: 125_050,
      reason: "Hasarlı kutu",
    })
    expect(requestOf(values, false)).not.toHaveProperty("discount")
    expect(previewOf(values, false)).not.toHaveProperty("discount")
    expect(discountNumber("percentage", "100")).toBeNull()
    expect(discountNumber("percentage", "12,5")).toBeNull()
  })

  it("prices nothing until a line has a whole quantity, and a discount once it has a reason", () => {
    expect(previewOf(form({ lines: [] }), true)).toBeNull()
    expect(
      previewOf(
        form({ lines: [{ variant_id: VARIANT_A, label: "x", quantity: Number.NaN }] }),
        true
      )
    ).toBeNull()
    const pending = form({ discountOn: true, discountValue: "10", discountReason: " " })
    expect(previewOf(pending, true)).toEqual({ lines: [{ variant_id: VARIANT_A, quantity: 2 }] })
  })

  it("says what is missing, field by field", () => {
    expect(issues(form({ guest: { ...EMPTY_FORM.guest, email: "ayse" }, lines: [] }))).toEqual([
      { path: "guest.first_name", message: "paymentLinks.form.errors.name" },
      { path: "guest.last_name", message: "paymentLinks.form.errors.name" },
      { path: "guest.email", message: "paymentLinks.form.errors.email" },
      { path: "lines", message: "paymentLinks.form.errors.lines" },
    ])
    expect(issues(form({ deliver: true, hours: "200" }))).toEqual(
      expect.arrayContaining([
        { path: "recipient_first", message: "paymentLinks.form.errors.name" },
        { path: "address_1", message: "address.errors.lineRequired" },
        { path: "province", message: "address.errors.provinceRequired" },
        { path: "hours", message: "paymentLinks.form.errors.hours" },
      ])
    )
    expect(issues(form(ADDRESS))).toEqual([])
  })

  it("fills a new form from a link: the customer, lines, address, discount and note", () => {
    const values = valuesFromLink(
      link({
        customer: { id: "cus_1", name: "Ayşe Y.", email: "a***@example.com" },
        discount: { type: "fixed", value: 5_000, amount: 5_000, reason: "Sadık müşteri" },
        address: {
          first_name: "Ayşe",
          last_name: "Yılmaz",
          phone: null,
          address_1: "Atatürk Cad. No: 5",
          address_2: null,
          city: "Kadıköy",
          province: "İstanbul",
          postal_code: null,
        },
        shipping_option_id: "so_1",
      }),
      true
    )
    expect(values).toMatchObject({
      customerMode: "existing",
      customer: { id: "cus_1", label: "Ayşe Yılmaz · ayse.yilmaz@example.com" },
      lines: [{ variant_id: VARIANT_A, label: "Şef bıçağı · 20 cm", quantity: 2 }],
      deliver: true,
      city: "Kadıköy",
      address_2: "",
      shipping_option_id: "so_1",
      discountOn: true,
      discountType: "fixed",
      discountValue: "50,00",
      note: "Instagram'dan yazdı",
      hours: "72",
    })
    expect(
      valuesFromLink(
        link({ discount: { type: "percentage", value: 10, amount: 2_700, reason: "x" } }),
        false
      ).discountOn
    ).toBe(false)
  })
})
