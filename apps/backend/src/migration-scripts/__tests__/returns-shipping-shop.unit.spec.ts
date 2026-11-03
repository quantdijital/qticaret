import { returnsSection } from "../../modules/platform-settings/sections/returns"
import { moveReturnShippingToShop } from "../returns-shipping-shop"

function fakes(returns: Record<string, unknown> | null) {
  const settings = {
    listSettingsSections: jest.fn(async () =>
      Promise.resolve(returns ? [{ values: returns }] : [])
    ),
    saveSection: jest.fn(async () => Promise.resolve({})),
  }
  const audit = { record: jest.fn(async () => Promise.resolve({})) }
  return { settings, audit }
}

describe("return shipping to the shop (adr/0032 Ek 2026-11-03 migration script)", () => {
  it("moves a shop that charged the customer to paying itself, as the system", async () => {
    const { settings, audit } = fakes({ withdrawal_days: 30, return_shipping: "customer" })
    expect(await moveReturnShippingToShop(settings as never, audit as never)).toBe(true)
    expect(settings.saveSection).toHaveBeenCalledWith("returns", { return_shipping: "shop" }, null)
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "system",
        resource_id: "returns",
        changes: { return_shipping: { before: "customer", after: "shop" } },
      })
    )
  })

  it.each([
    ["a shop that never saved its return policy", null],
    ["a shop paying already", { withdrawal_days: 14, return_shipping: "shop" }],
  ])("leaves %s", async (_label, stored) => {
    const { settings, audit } = fakes(stored)
    expect(await moveReturnShippingToShop(settings as never, audit as never)).toBe(false)
    expect(settings.saveSection).not.toHaveBeenCalled()
    expect(audit.record).not.toHaveBeenCalled()
  })

  it("no longer takes the customer paying, with the law's reason (MSY md. 12/5)", () => {
    const refused = returnsSection.patch.safeParse({ return_shipping: "customer" })
    expect(refused.success).toBe(false)
    expect(refused.error?.issues[0]?.message).toBe("platform_settings.return_shipping_shop_only")
    expect(returnsSection.patch.safeParse({ return_shipping: "shop" }).success).toBe(true)
  })
})
