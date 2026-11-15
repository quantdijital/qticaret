import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "../../http/reject"
import { rejectStorePriceRows } from "../attribute-fields"

// The refusal's own answer (headers, request id) is the error handler's, tested there
jest.mock("../../http/reject", () => ({ rejectRequest: jest.fn() }))

const reject = rejectRequest as jest.MockedFunction<typeof rejectRequest>

function run(fields: string) {
  reject.mockClear()
  const req = { method: "GET", query: { fields } } as unknown as MedusaRequest
  const next = jest.fn()
  rejectStorePriceRows(req, {} as MedusaResponse, next)
  return {
    status: reject.mock.calls[0]?.[2] ?? null,
    reason: reject.mock.calls[0]?.[4] ?? null,
    passed: next.mock.calls.length === 1,
  }
}

describe("price rows kept out of the Store API (ADR-0068 §7, M3)", () => {
  it.each([
    "*variants.prices",
    "variants.prices",
    "+variants.prices.amount",
    "variants.price_set",
    "+variants.price_set.prices",
    "*variants.price_set",
    "prices",
    "title,*variants.prices",
  ])("refuses %s", (fields) => {
    expect(run(fields)).toEqual({ status: 400, reason: "price_row_fields", passed: false })
  })

  it.each(["*variants.calculated_price", "variants.calculated_price.calculated_amount", "title"])(
    "lets %s through",
    (fields) => {
      expect(run(fields)).toEqual({ status: null, reason: null, passed: true })
    }
  )
})
