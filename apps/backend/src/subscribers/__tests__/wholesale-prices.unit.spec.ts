import type { SubscriberArgs } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules, PricingEvents } from "@medusajs/framework/utils"
import { syncVariants } from "../../workflows/wholesale/sync"
import wholesalePrices from "../wholesale-prices"

jest.mock("../../workflows/wholesale/sync", () => ({ syncVariants: jest.fn() }))

const sync = syncVariants as jest.MockedFunction<typeof syncVariants>

function args(name: string, priceListId: string | null) {
  const listPrices = jest
    .fn()
    .mockResolvedValue([{ price_list_id: priceListId, price_set_id: "pset_1" }])
  const graph = jest.fn().mockResolvedValue({ data: [{ variant_id: "variant_1" }] })
  const services: Record<string, unknown> = {
    [Modules.PRICING]: { listPrices },
    [ContainerRegistrationKeys.QUERY]: { graph },
  }
  const container = { resolve: (key: string) => services[key] }
  return {
    listPrices,
    input: {
      event: { name, data: { id: "price_1" } },
      container,
    } as unknown as SubscriberArgs<{ id: string }>,
  }
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe("a variant's own price written (ADR-0068 §4)", () => {
  it("resyncs its rated wholesale rows, reading a deleted price too (L6)", async () => {
    const { listPrices, input } = args(PricingEvents.PRICE_DELETED, null)
    await wholesalePrices(input)
    for (const [, config] of listPrices.mock.calls) {
      expect(config).toMatchObject({ withDeleted: true })
    }
    expect(sync).toHaveBeenCalledWith(input.container, ["variant_1"], { ratedOnly: true })
  })

  it("passes a price list's row by: no variant's own price changed", async () => {
    const { input } = args(PricingEvents.PRICE_CREATED, "plist_1")
    await wholesalePrices(input)
    expect(sync).not.toHaveBeenCalled()
  })
})
