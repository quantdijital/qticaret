import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireUserActor } from "../actor"
import { ORDER_REFUND_ROUTES, capturesTheRest, refusePartialCapture } from "../order-refund-routes"

/** A capture request for a payment of 1.000 TL by `provider` (300 TL captured), its body as sent. */
function captureOf(provider: string | null, body: unknown, method = "POST") {
  const graph = jest.fn(() =>
    Promise.resolve({
      data:
        provider === null
          ? []
          : [{ provider_id: provider, amount: 1000, captures: [{ amount: 300 }] }],
    })
  )
  const req = {
    method,
    body,
    params: { id: "pay_1" },
    scope: { resolve: () => ({ graph }) },
  } as unknown as MedusaRequest
  return { req, graph }
}

async function run(req: MedusaRequest): Promise<unknown> {
  const next = jest.fn<undefined, [unknown?]>()
  await refusePartialCapture(req, {} as MedusaResponse, next)
  expect(next).toHaveBeenCalledTimes(1)
  return next.mock.calls[0]?.[0]
}

describe("a partial capture (refund safety follow-up of adr/0076)", () => {
  it.each(["pp_cod_cod", "pp_bank-transfer_bank-transfer", "pp_paytr_paytr", "pp_iyzico_iyzico"])(
    "is refused for %s: the amount is never the client's",
    async (provider) => {
      const { req } = captureOf(provider, { amount: 100 })

      const error = await run(req)

      expect(error).toEqual(
        expect.objectContaining({ safeMessage: "payments.partial_capture_refused" })
      )
    }
  )

  it("lets the rest the server works out be asked for by amount (review D1 of #277)", async () => {
    expect(await run(captureOf("pp_cod_cod", { amount: 700 }).req)).toBeUndefined()
    expect(await run(captureOf("pp_cod_cod", { amount: 699.99 }).req)).toBeDefined()
    expect(await run(captureOf("pp_cod_cod", { amount: 1000 }).req)).toBeDefined()
  })

  it("lets the whole payment be captured without reading it", async () => {
    const { req, graph } = captureOf("pp_cod_cod", {})

    expect(await run(req)).toBeUndefined()
    expect(graph).not.toHaveBeenCalled()
  })

  it("leaves the system provider and an unknown payment to Medusa", async () => {
    expect(await run(captureOf("pp_system_default", { amount: 100 }).req)).toBeUndefined()
    expect(await run(captureOf(null, { amount: 100 }).req)).toBeUndefined()
  })

  it("reads nothing for another method", async () => {
    const { req, graph } = captureOf("pp_cod_cod", { amount: 100 }, "GET")

    expect(await run(req)).toBeUndefined()
    expect(graph).not.toHaveBeenCalled()
  })

  it("runs on the capture's route for every method, after the staff check", () => {
    const route = ORDER_REFUND_ROUTES.find(
      (entry) => entry.matcher === "/admin/payments/:id/capture"
    )
    expect(route && "methods" in route).toBe(false)
    expect(route?.middlewares).toEqual([requireUserActor, refusePartialCapture])
  })
})

describe("the rest of a payment", () => {
  it("is its amount less its captures, to the kuruş", () => {
    const payment = { amount: 1000.5, captures: [{ amount: 300 }, null] }

    expect(capturesTheRest(700.5, payment)).toBe(true)
    expect(capturesTheRest(700.49, payment)).toBe(false)
    expect(capturesTheRest(700.501, payment)).toBe(false)
    expect(capturesTheRest("0x10", payment)).toBe(false)
    expect(capturesTheRest(1000, { amount: 1000, captures: [] })).toBe(true)
  })
})
