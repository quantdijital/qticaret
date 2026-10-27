import { kurus } from "../../money"
import { COD_FEE, codFee, codRefusal, feeFacts, feeLinesMatch, isFeeLine } from "../cod"

const settings = {
  fee_type: "fixed" as const,
  fee_value: 2_500,
  max_amount: 500_000,
  shipping_option_ids: ["so_door"],
}

describe("cash on delivery (adr/0029)", () => {
  it("works the fee out on the server: fixed, a share rounded to the kuruş, or none", () => {
    expect(codFee(settings, kurus(21_000))).toBe(2_500)
    expect(codFee({ ...settings, fee_type: "percent", fee_value: 250 }, kurus(21_050))).toBe(526)
    expect(codFee({ ...settings, fee_type: "none" }, kurus(21_000))).toBe(0)
  })

  it("is offered only with the flag on, within the limit, with a courier that collects", () => {
    const cart = { amount: kurus(21_000), shipping_option_ids: ["so_door"] }

    expect(codRefusal(settings, true, cart)).toBeNull()
    expect(codRefusal(settings, false, cart)).toBe("cash_on_delivery.disabled")
    expect(codRefusal(settings, true, { ...cart, amount: kurus(600_000) })).toBe(
      "cash_on_delivery.over_limit"
    )
    expect(
      codRefusal({ ...settings, max_amount: 0 }, true, { ...cart, amount: kurus(600_000) })
    ).toBeNull()
    expect(codRefusal(settings, true, { ...cart, shipping_option_ids: ["so_other"] })).toBe(
      "cash_on_delivery.shipping_unsupported"
    )
    expect(codRefusal(settings, true, { ...cart, shipping_option_ids: [] })).toBe(
      "cash_on_delivery.shipping_unsupported"
    )
  })

  it("counts as the fee only the server's line: marked, without a product, priced by us", () => {
    const fee = {
      id: "ln_fee",
      metadata: { qt_fee: COD_FEE },
      variant_id: null,
      is_custom_price: true,
    }
    const copied = { ...fee, id: "ln_goods", variant_id: "variant_1", is_custom_price: false }
    const cart = {
      raw_total: "235",
      items: [
        { ...fee, raw_total: "25" },
        { ...copied, raw_total: "210" },
      ],
      shipping_methods: [{ shipping_option_id: "so_door" }],
    }

    expect(isFeeLine(fee)).toBe(true)
    expect(isFeeLine(copied)).toBe(false)
    expect(isFeeLine({ ...fee, is_custom_price: false })).toBe(false)
    const facts = feeFacts(cart)
    expect(facts.lines.map((line) => line.id)).toEqual(["ln_fee"])
    expect(facts.base).toBe(21_000)
    expect(feeLinesMatch(facts, kurus(2_500))).toBe(true)
    expect(feeLinesMatch(facts, kurus(0))).toBe(false)
    expect(feeLinesMatch(feeFacts({ items: [] }), kurus(0))).toBe(true)
  })
})
