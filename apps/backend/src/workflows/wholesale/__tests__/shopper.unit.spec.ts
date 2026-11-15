import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import { shopperVariantIds } from "../../pricing/selling-prices"
import { wholesaleContext } from "../context"
import { NOT_WHOLESALE, wholesalePrices, wholesaleShopper } from "../shopper"

jest.mock("../../pricing/selling-prices", () => ({ shopperVariantIds: jest.fn() }))
jest.mock("../context", () => ({ wholesaleContext: jest.fn() }))

const visible = shopperVariantIds as jest.MockedFunction<typeof shopperVariantIds>
const context = wholesaleContext as jest.MockedFunction<typeof wholesaleContext>

interface Shop {
  enabled?: boolean
  accounts?: { id: string; tier_id: string | null; min_quantity: number | null }[]
  tierMinimum?: number | null
  groups?: string[]
  variants?: unknown[]
}

function container(shop: Shop) {
  const listWholesaleAccounts = jest.fn((filters: Record<string, unknown>) =>
    Promise.resolve(filters["status"] === "active" ? (shop.accounts ?? []) : [])
  )
  const graph = jest.fn((config: { entity: string }) =>
    Promise.resolve({
      data:
        config.entity === "customer"
          ? [{ groups: (shop.groups ?? []).map((id) => ({ id })) }]
          : (shop.variants ?? []),
    })
  )
  const services: Record<string, unknown> = {
    [PLATFORM_SETTINGS_MODULE]: { isFeatureEnabled: () => Promise.resolve(shop.enabled ?? true) },
    [WHOLESALE_MODULE]: {
      listWholesaleAccounts,
      listWholesaleTiers: () => Promise.resolve([{ min_quantity: shop.tierMinimum ?? null }]),
    },
    [ContainerRegistrationKeys.QUERY]: { graph },
  }
  return {
    scope: { resolve: (key: string) => services[key] },
    listWholesaleAccounts,
    graph,
  }
}

const ACTIVE = [{ id: "wacc_1", tier_id: "wtier_1", min_quantity: null }]

beforeEach(() => {
  jest.clearAllMocks()
  visible.mockImplementation((_scope, ids) => Promise.resolve([...ids]))
  context.mockResolvedValue({ currency: "try", vatOf: () => 2000 })
})

/** ADR-0068 §7: the signed-in customer as a wholesaler, from the session's id only. */
describe("wholesaleShopper", () => {
  it("answers an active wholesaler with KDV left out and the level's minimum", async () => {
    const { scope, listWholesaleAccounts } = container({ accounts: ACTIVE, tierMinimum: 12 })
    expect(await wholesaleShopper(scope, "cus_1")).toEqual({
      active: true,
      vat_exclusive: true,
      min_quantity: 12,
    })
    expect(listWholesaleAccounts).toHaveBeenCalledWith(
      { customer_id: "cus_1", status: "active" },
      expect.anything()
    )
  })

  it("takes the wholesaler's own minimum over the level's", async () => {
    const own = [{ id: "wacc_1", tier_id: "wtier_1", min_quantity: 5 }]
    const { scope } = container({ accounts: own, tierMinimum: 12 })
    expect((await wholesaleShopper(scope, "cus_1")).min_quantity).toBe(5)
  })

  it("answers anyone else alike: no account, a pending or closed one, the flag off", async () => {
    expect(await wholesaleShopper(container({}).scope, "cus_1")).toEqual(NOT_WHOLESALE)
    const off = container({ enabled: false, accounts: ACTIVE })
    expect(await wholesaleShopper(off.scope, "cus_1")).toEqual(NOT_WHOLESALE)
    expect(off.listWholesaleAccounts).not.toHaveBeenCalled()
    expect(await wholesaleShopper(container({ accounts: ACTIVE }).scope, "")).toEqual(NOT_WHOLESALE)
  })

  it("never names the level or a group", async () => {
    const answer = await wholesaleShopper(container({ accounts: ACTIVE }).scope, "cus_1")
    expect(Object.keys(answer).sort()).toEqual(["active", "min_quantity", "vat_exclusive"])
  })
})

describe("wholesalePrices", () => {
  const input = { customer_id: "cus_1", variant_ids: ["variant_a"], sales_channel_ids: ["sc_1"] }

  it("prices nothing for a customer who is not an active wholesaler", async () => {
    const shop = container({ variants: [{ id: "variant_a" }] })
    expect((await wholesalePrices(shop.scope, input)).size).toBe(0)
    expect(shop.graph).not.toHaveBeenCalled()
    expect(visible).not.toHaveBeenCalled()
  })

  it("asks Medusa with the customer's own groups and shows net and gross", async () => {
    const shop = container({
      accounts: ACTIVE,
      groups: ["cusgroup_level", "cusgroup_own"],
      variants: [
        {
          id: "variant_a",
          product: { type_id: "ptyp_1" },
          calculated_price: { calculated_amount: 80, is_calculated_price_tax_inclusive: true },
        },
        { id: "variant_b", calculated_price: { calculated_amount: null } },
      ],
    })
    const prices = await wholesalePrices(shop.scope, {
      ...input,
      variant_ids: ["variant_a", "variant_b", "variant_a"],
    })
    expect(Object.fromEntries(prices)).toEqual({
      variant_a: { net: 6667, gross: 8000, vat_bps: 2000 },
    })
    expect(visible).toHaveBeenCalledWith(shop.scope, ["variant_a", "variant_b"], ["sc_1"])
    const variantRead = shop.graph.mock.calls
      .map(([config]) => config as unknown as { entity: string; context?: unknown })
      .find((config) => config.entity === "product_variant")
    expect(JSON.stringify(variantRead?.context)).toContain("cusgroup_own")
    expect(JSON.stringify(variantRead?.context)).toContain('"customer_id":"cus_1"')
  })

  it("leaves out a variant a shopper may not see", async () => {
    visible.mockResolvedValue([])
    const shop = container({ accounts: ACTIVE, variants: [{ id: "variant_a" }] })
    expect((await wholesalePrices(shop.scope, input)).size).toBe(0)
    expect(shop.graph).not.toHaveBeenCalled()
  })
})
