import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PriceDisplay, StoreProduct, StoreVariant } from "@qticaret/types"
import { StoreApiError } from "../errors"

// The request's headers (no session), the lira region, and the backend's answers as the test sets them
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))
vi.mock("../../env", () => ({ storefrontEnv: () => ({ NODE_ENV: "test" }) }))
vi.mock("../requests", () => ({
  liraRegion: () => Promise.resolve({ id: "reg_tr", name: "Türkiye", currency_code: "try" }),
}))
const core = vi.hoisted(() => ({ storeRequest: vi.fn() }))
vi.mock("../core", () => core)

const { installmentSummaries, variantInstallments } = await import("../installments")
const { forgetShared } = await import("../shared")

const variant = (id: string, amount: number, stocked = true): StoreVariant => ({
  id,
  title: id,
  sku: null,
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: stocked ? 3 : 0,
  calculated_price: { calculated_amount: amount, original_amount: amount, currency_code: "try" },
})

const product = (variants: StoreVariant[]) => ({ id: "prod_1", variants }) as StoreProduct

/** The backend's table for an amount: twelve installments at 19,39 %. */
const answer = (amount: number) => ({
  data: {
    installments: {
      enabled: true,
      max_count: 12,
      families: [
        {
          family: "world",
          options: [
            { count: 1, rate: 0, total: amount.toFixed(2), per_installment: amount.toFixed(2) },
            {
              count: 12,
              rate: 19.39,
              total: (amount * 1.1939).toFixed(2),
              per_installment: ((amount * 1.1939) / 12).toFixed(2),
            },
          ],
        },
      ],
    },
  },
})

const asked = () =>
  core.storeRequest.mock.calls.map(
    ([path, request]) =>
      `${String(path)} ${(request as { query: { variant_id: string } }).query.variant_id}`
  )

describe("installmentSummaries", () => {
  beforeEach(() => {
    core.storeRequest.mockReset()
    core.storeRequest.mockImplementation(
      (_path: string, request: { query: { variant_id: string } }) =>
        Promise.resolve(answer(request.query.variant_id === "variant_buyuk00000" ? 2500 : 1968.75))
    )
    forgetShared(["/store/payment/installments"])
  })

  it("asks the backend once per price the variants share, never for one out of stock", async () => {
    const colours = product([
      variant("variant_kirmizi000", 1968.75),
      variant("variant_yesil00000", 1968.75),
      variant("variant_buyuk00000", 2500),
      variant("variant_mor0000000", 1968.75, false),
    ])
    const lines = await installmentSummaries(colours, {})

    expect(asked()).toEqual([
      "/store/payment/installments variant_kirmizi000",
      "/store/payment/installments variant_buyuk00000",
    ])
    expect(lines).toEqual({
      variant_kirmizi000: { count: 12, perInstallment: "195,87 TL" },
      variant_yesil00000: { count: 12, perInstallment: "195,87 TL" },
      variant_buyuk00000: { count: 12, perInstallment: "248,73 TL" },
    })
  })

  it("keeps a price's line: the next view asks nothing, a new price asks again", async () => {
    const one = product([variant("variant_kirmizi000", 1968.75)])
    await installmentSummaries(one, {})
    await installmentSummaries(one, {})
    expect(core.storeRequest).toHaveBeenCalledTimes(1)

    // An automatic promotion lowers the price the page shows: a new line
    const display = { current: "1500.00" } as PriceDisplay
    await installmentSummaries(one, { variant_kirmizi000: display })
    expect(core.storeRequest).toHaveBeenCalledTimes(2)
  })

  it("leaves the line out when the backend does not answer, and keeps no failure", async () => {
    core.storeRequest.mockRejectedValueOnce(new StoreApiError(502, null, null))
    const one = product([variant("variant_kirmizi000", 1968.75)])
    await expect(installmentSummaries(one, {})).resolves.toEqual({})
    await Promise.resolve()
    await expect(installmentSummaries(one, {})).resolves.toHaveProperty("variant_kirmizi000")
    expect(core.storeRequest).toHaveBeenCalledTimes(2)
  })
})

describe("variantInstallments", () => {
  beforeEach(() => {
    core.storeRequest.mockReset()
    forgetShared(["/store/payment/installments"])
  })

  it("asks shop-wide, without the customer's key, and is null on a refusal", async () => {
    core.storeRequest.mockRejectedValueOnce(new StoreApiError(404, null, null))
    await expect(variantInstallments("variant_yok0000000")).resolves.toBeNull()
    const request = core.storeRequest.mock.calls[0]?.[1] as { headers?: unknown; query: unknown }
    expect(request.headers).toBeUndefined()
    expect(request.query).toEqual({ variant_id: "variant_yok0000000", region_id: "reg_tr" })
  })
})
