import { kurus } from "../../money"
import { codFee, codRefusal } from "../cod"

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
})
