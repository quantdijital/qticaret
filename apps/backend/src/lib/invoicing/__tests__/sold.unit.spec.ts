import { MathBN } from "@medusajs/framework/utils"
import { asSold, invoiceLines, invoiceTotals } from ".."
import type { SoldItem } from ".."

const vat20 = [{ rate: 20 }]

// A 120 TL pan (KDV included) Medusa reads at 0 once it came back
const returned = (changes: Partial<SoldItem> = {}): SoldItem => ({
  id: "line_1",
  product_title: "Döküm tava",
  quantity: 1,
  subtotal: 0,
  discount_subtotal: 0,
  tax_total: 0,
  total: 0,
  tax_lines: vat20,
  raw_unit_price: { value: "120", precision: 20 },
  is_tax_inclusive: true,
  ...changes,
})

const amount = (value: unknown) => MathBN.convert(value as number).toNumber()

describe("an order's lines as sold (adr/0010)", () => {
  it("prices a line that came back at what it was sold for", () => {
    const [item] = asSold({ version: 3, items: [returned()] }).items

    expect(amount(item?.total)).toBe(120)
    expect(amount(item?.subtotal)).toBe(100)
    expect(amount(item?.tax_total)).toBe(20)
    expect(invoiceTotals(invoiceLines({ items: [item ?? null] }))).toEqual({
      net: "100.00",
      vat: "20.00",
      gross: "120.00",
    })
  })

  it("counts the current version's discount only, as Medusa does", () => {
    const [item] = asSold({
      version: 3,
      items: [
        returned({
          adjustments: [
            { raw_amount: { value: "12", precision: 20 }, is_tax_inclusive: true, version: 2 },
            { raw_amount: { value: "12", precision: 20 }, is_tax_inclusive: true, version: 3 },
          ],
        }),
      ],
    }).items

    expect(amount(item?.total)).toBe(108)
    expect(amount(item?.discount_subtotal)).toBe(10)
  })

  it("leaves a line read without its price as it came", () => {
    const plain = returned({ raw_unit_price: null, total: 55 })

    expect(asSold({ items: [plain] }).items[0]).toBe(plain)
  })
})
