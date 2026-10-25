import { EventEmitter } from "node:events"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import { auditMutations, auditSensitiveRead, describeRoute, diffSnapshots } from "../audit"
import { matchAuditedResource } from "../audit/registry"
import { fakeResponse } from "./fakes"

const flush = () => new Promise((resolve) => setImmediate(resolve))

function fakes(fields: {
  path: string
  method?: string
  body?: unknown
  record?: jest.Mock
  graph?: jest.Mock
}) {
  const record = fields.record ?? jest.fn(() => Promise.resolve({ id: "aud_1" }))
  const graph = fields.graph ?? jest.fn(() => Promise.resolve({ data: [] }))
  const req = {
    originalUrl: fields.path,
    method: fields.method ?? "POST",
    body: fields.body ?? {},
    headers: { "user-agent": "jest" },
    ip: "203.0.113.7",
    requestId: "req-12345678",
    auth_context: { actor_type: "user", actor_id: "user_01ABC" },
    scope: {
      resolve: (key: string) =>
        key === AUDIT_LOG_MODULE
          ? { record }
          : key === ContainerRegistrationKeys.QUERY
            ? { graph }
            : undefined,
    },
  } as unknown as MedusaRequest
  return { req, record, graph }
}

function finishingResponse(statusCode: number) {
  const res = Object.assign(new EventEmitter(), { statusCode })
  return res as unknown as MedusaResponse & EventEmitter
}

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
  jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  jest.spyOn(logger, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("audit registry", () => {
  it.each([
    ["POST", "/admin/products/prod_01ABC", "POST /admin/products/:id", { id: "prod_01ABC" }],
    [
      "POST",
      "/admin/products/prod_01ABC/variants/variant_01XYZ",
      "POST /admin/products/:id/variants/:variant_id",
      { id: "prod_01ABC", variant_id: "variant_01XYZ" },
    ],
    [
      "POST",
      "/admin/products/prod_01ABC/variants/batch",
      "POST /admin/products/:id/variants/batch",
      { id: "prod_01ABC" },
    ],
    [
      "POST",
      "/admin/price-lists/plist_01ABC/prices/batch",
      "POST /admin/price-lists/:id/prices/batch",
      { id: "plist_01ABC" },
    ],
  ])("matches %s %s", (method, path, route, params) => {
    expect(matchAuditedResource(method, path)).toMatchObject({ resource: { route }, params })
  })

  it("matches a path in another case and keeps the IDs as they are", () => {
    expect(matchAuditedResource("POST", "/ADMIN/Products/prod_01ABC")).toMatchObject({
      params: { id: "prod_01ABC" },
    })
    expect(describeRoute("POST", "/ADMIN/Regions/reg_01ABC")).toMatchObject({
      action: "POST /admin/regions/:id",
      resourceId: "reg_01ABC",
    })
  })

  it("leaves other routes and methods to the generic entry", () => {
    expect(matchAuditedResource("DELETE", "/admin/products/prod_01ABC")).toBeNull()
    expect(matchAuditedResource("POST", "/admin/regions/reg_01ABC")).toBeNull()
  })

  it("describes a route by its pattern, area and first ID", () => {
    expect(describeRoute("POST", "/admin/customers/cus_01ABC/addresses/cuaddr_01X")).toEqual({
      action: "POST /admin/customers/:id/addresses/:id",
      resourceType: "customers",
      resourceId: "cus_01ABC",
    })
    expect(describeRoute("POST", "/admin/products/batch")).toEqual({
      action: "POST /admin/products/batch",
      resourceType: "products",
      resourceId: null,
    })
  })
})

describe("diffSnapshots", () => {
  it("keeps changed, added and removed fields only", () => {
    expect(
      diffSnapshots(
        { "price:p1": "1000 try", "price:p2": "500 try", same: 1 },
        { "price:p1": "1250 try", "price:p3": "700 try", same: 1 }
      )
    ).toEqual({
      "price:p1": { before: "1000 try", after: "1250 try" },
      "price:p2": { before: "500 try" },
      "price:p3": { after: "700 try" },
    })
  })

  it("writes a sensitive field as changed with its last four characters", () => {
    expect(
      diffSnapshots({ iban: "TR001" }, { iban: "TR330006100519786457841326" }, ["iban"])
    ).toEqual({ iban: { changed: true, after_last4: "1326" } })
  })
})

describe("auditMutations", () => {
  it("records a registered resource with what changed, after the response", async () => {
    const graph = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ prices: [{ id: "price_1", amount: 1000, currency_code: "try" }] }],
      })
      .mockResolvedValueOnce({
        data: [{ prices: [{ id: "price_1", amount: 1250, currency_code: "try" }] }],
      })
    const { req, record } = fakes({
      path: "/admin/products/prod_1A/variants/variant_1B",
      body: { prices: [{ amount: 1250 }] },
      graph,
    })
    const res = finishingResponse(200)
    const next = jest.fn()

    await auditMutations(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
    res.emit("finish")
    await flush()

    expect(record).toHaveBeenCalledWith({
      kind: "mutation",
      action: "POST /admin/products/:id/variants/:variant_id",
      resource_type: "product_variant",
      resource_id: "variant_1B",
      actor_type: "user",
      actor_id: "user_01ABC",
      request_id: "req-12345678",
      ip: "203.0.113.7",
      user_agent: "jest",
      outcome: 200,
      changes: {
        fields: ["prices"],
        diff: { "price:price_1": { before: "1000 try", after: "1250 try" } },
      },
    })
  })

  it("records an unregistered route with field names, never values", async () => {
    const { req, record } = fakes({
      path: "/admin/regions",
      body: { name: "Gizli Bölge", currency_code: "try" },
    })
    const res = finishingResponse(200)

    await auditMutations(req, res, jest.fn())
    res.emit("finish")
    await flush()

    const entry = (record.mock.calls[0] as [Record<string, unknown>])[0]
    expect(entry).toMatchObject({
      action: "POST /admin/regions",
      changes: { fields: ["name", "currency_code"] },
    })
    expect(JSON.stringify(entry)).not.toContain("Gizli")
  })

  it("does not read again after a refused request", async () => {
    const graph = jest.fn(() => Promise.resolve({ data: [{ prices: [] }] }))
    const { req, record } = fakes({ path: "/admin/products/prod_1A/variants/variant_1B", graph })
    const res = finishingResponse(400)

    await auditMutations(req, res, jest.fn())
    res.emit("finish")
    await flush()

    expect(graph).toHaveBeenCalledTimes(1)
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 400, changes: { fields: [] } })
    )
  })

  it("skips reads", async () => {
    const { req, record } = fakes({ path: "/admin/products", method: "GET" })
    const next = jest.fn()

    await auditMutations(req, finishingResponse(200), next)

    expect(next).toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
  })

  it("logs a failed write instead of throwing", async () => {
    const { req } = fakes({
      path: "/admin/regions",
      record: jest.fn(() => Promise.reject(new Error("db down"))),
    })
    const res = finishingResponse(200)

    await auditMutations(req, res, jest.fn())
    res.emit("finish")
    await flush()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "audit.write_failed", action: "POST /admin/regions" })
    )
  })
})

describe("auditSensitiveRead", () => {
  it("records the read before letting it through", async () => {
    const { req, record } = fakes({
      path: "/admin/customers/cus_01A/billing-profile",
      method: "GET",
    })
    const next = jest.fn()

    await auditSensitiveRead("customer")(req, fakeResponse().res, next)

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "sensitive_read",
        action: "GET /admin/customers/:id/billing-profile",
        resource_type: "customer",
        resource_id: "cus_01A",
        actor_id: "user_01ABC",
      })
    )
    expect(next).toHaveBeenCalled()
  })

  it("refuses the read with 503 when the record cannot be written", async () => {
    const { req } = fakes({
      path: "/admin/customers/cus_01A",
      method: "GET",
      record: jest.fn(() => Promise.reject(new Error("db down"))),
    })
    const response = fakeResponse()
    const next = jest.fn()

    await auditSensitiveRead("customer")(req, response.res, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.status()).toBe(503)
    expect(response.body()).toMatchObject({ message: "errors.temporarily_unavailable" })
  })
})
