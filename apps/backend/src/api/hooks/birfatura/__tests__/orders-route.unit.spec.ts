import type { MedusaRequest } from "@medusajs/framework/http"
import { fakeResponse } from "../../../http/__tests__/fakes"
import { logger } from "../../../../lib/logging"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"
import { EINVOICE_MODULE } from "../../../../modules/einvoice"
import { POST } from "../api/orders/route"
import type { BirfaturaOrdersBodyType } from "../validators"

// No environment to read in a unit test: the address and the response headers
jest.mock("../../../http/client-ip", () => ({ clientIp: () => "203.0.113.7" }))
jest.mock("../../../http/security-headers", () => ({ applySecurityHeaders: () => undefined }))

// Two invoices waiting: what the list read before any stamp
jest.mock("../../../../workflows/einvoice/birfatura-orders", () => {
  const actual = jest.requireActual<Record<string, unknown>>(
    "../../../../workflows/einvoice/birfatura-orders"
  )
  return {
    ...actual,
    birfaturaOrders: () =>
      Promise.resolve({
        orders: [{ OrderId: 1001 }, { OrderId: 1002 }],
        listed: [
          { invoice_id: "inv_kept", order_id: "order_1", birfatura_id: 1001 },
          { invoice_id: "inv_canceled", order_id: "order_2", birfatura_id: 1002 },
        ],
        skipped: [],
      }),
  }
})

const body: BirfaturaOrdersBodyType = {
  orderStatusId: 1,
  startDateTime: "17.11.2026 00:00:00",
  endDateTime: "18.11.2026 00:00:00",
}

function request(record: () => Promise<unknown>) {
  const calls: string[] = []
  // The stamp keeps only what is still waiting: the other was canceled after the list
  const markListed = jest.fn((ids: string[]) => {
    calls.push("stamp")
    return Promise.resolve(ids.filter((id) => id === "inv_kept"))
  })
  // The entry it is given is read back from the mock's calls
  const audit = jest.fn<Promise<unknown>, [unknown]>(() => {
    calls.push("audit")
    return record()
  })
  const services: Record<string, unknown> = {
    [EINVOICE_MODULE]: { markListed },
    [AUDIT_LOG_MODULE]: { record: audit },
  }
  const req = {
    path: "/hooks/birfatura/api/orders",
    originalUrl: "/hooks/birfatura/api/orders",
    method: "POST",
    headers: {},
    socket: {},
    requestId: "req-12345678",
    validatedBody: body,
    scope: { resolve: (name: string) => services[name] },
  } as unknown as MedusaRequest<BirfaturaOrdersBodyType>
  return { req, calls, markListed, audit }
}

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
  jest.spyOn(logger, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("BirFatura's pull stamps before it answers (security review S-1)", () => {
  it("answers only what the stamp kept: an invoice canceled after the list is not handed out", async () => {
    const { req, calls, markListed, audit } = request(() => Promise.resolve({}))
    const response = fakeResponse()

    await POST(req, response.res)

    expect(calls).toEqual(["stamp", "audit"])
    expect(markListed).toHaveBeenCalledWith(["inv_kept", "inv_canceled"])
    expect(response.body()).toEqual({ Orders: [{ OrderId: 1001 }] })
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      changes: {
        orders: 1,
        listed: [{ invoice_id: "inv_kept", order_id: "order_1", birfatura_id: 1001 }],
      },
    })
  })

  it("answers 503 when the pull cannot be recorded, its stamps already kept", async () => {
    const { req, calls } = request(() => Promise.reject(new Error("audit store down")))
    const response = fakeResponse()

    await POST(req, response.res)

    expect(calls).toEqual(["stamp", "audit"])
    expect(response.status()).toBe(503)
    expect(JSON.stringify(response.body())).not.toContain("1001")
  })
})
