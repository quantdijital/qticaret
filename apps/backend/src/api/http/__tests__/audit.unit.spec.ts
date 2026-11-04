import { EventEmitter } from "node:events"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import {
  auditMutations,
  auditPath,
  auditSensitiveRead,
  describeRoute,
  diffSnapshots,
  matchAuditedResource,
} from "../audit"
import { requireUserActor } from "../actor"
import { fakeResponse } from "./fakes"

const flush = () => new Promise((resolve) => setImmediate(resolve))

function fakes(fields: {
  path: string
  method?: string
  body?: unknown
  query?: Record<string, unknown>
  params?: Record<string, string>
  record?: jest.Mock
  graph?: jest.Mock
}) {
  const record = fields.record ?? jest.fn(() => Promise.resolve({ id: "aud_1" }))
  const graph = fields.graph ?? jest.fn(() => Promise.resolve({ data: [] }))
  const req = {
    originalUrl: fields.path,
    method: fields.method ?? "POST",
    body: fields.body ?? {},
    query: fields.query ?? {},
    params: fields.params ?? {},
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

// `end` is what the handler calls; "finish" follows only while the client is connected
function finishingResponse(statusCode: number) {
  const res = Object.assign(new EventEmitter(), { statusCode, end: jest.fn() })
  return res as unknown as MedusaResponse & EventEmitter & { end: jest.Mock }
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

  it.each([
    ["POST", "/admin/products/batch", "POST /admin/products/batch"],
    ["POST", "/admin/products/prod_01A/variants", "POST /admin/products/:id/variants"],
    ["DELETE", "/admin/products/prod_01A", "DELETE /admin/products/:id"],
    ["POST", "/admin/price-lists/plist_01A", "POST /admin/price-lists/:id"],
    ["DELETE", "/admin/price-lists/plist_01A", "DELETE /admin/price-lists/:id"],
    ["POST", "/admin/price-lists/plist_01A/products", "POST /admin/price-lists/:id/products"],
    ["POST", "/admin/promotions/promo_01A", "POST /admin/promotions/:id"],
    ["DELETE", "/admin/promotions/promo_01A", "DELETE /admin/promotions/:id"],
    ["POST", "/admin/campaigns/procamp_01A", "POST /admin/campaigns/:id"],
    ["DELETE", "/admin/campaigns/procamp_01A", "DELETE /admin/campaigns/:id"],
    ["POST", "/admin/promotions/promo_01A/rules/batch", "POST /admin/promotions/:id/rules/batch"],
    [
      "POST",
      "/admin/promotions/promo_01A/buy-rules/batch",
      "POST /admin/promotions/:id/buy-rules/batch",
    ],
    ["POST", "/admin/campaigns/procamp_01A/promotions", "POST /admin/campaigns/:id/promotions"],
    [
      "POST",
      "/admin/store-credit-accounts/sc_acc_01A/credit",
      "POST /admin/store-credit-accounts/:id/credit",
    ],
    [
      "POST",
      "/admin/store-credit-accounts/sc_acc_01A/debit",
      "POST /admin/store-credit-accounts/:id/debit",
    ],
    ["POST", "/admin/gift-cards", "POST /admin/gift-cards"],
    ["POST", "/admin/gift-cards/gcard_01A", "POST /admin/gift-cards/:id"],
  ])("covers every price-bearing route: %s %s", (method, path, route) => {
    expect(matchAuditedResource(method, path)?.resource.route).toBe(route)
  })

  it.each([
    [
      "POST",
      "/admin/legal-documents/return_policy/publish",
      "POST /admin/legal-documents/:kind/publish",
    ],
    [
      "DELETE",
      "/admin/legal-documents/return_policy/draft",
      "DELETE /admin/legal-documents/:kind/draft",
    ],
    [
      "POST",
      "/admin/legal-documents/return_policy/draft/reset",
      "POST /admin/legal-documents/:kind/draft/reset",
    ],
  ])("records a legal text's %s %s by its kind", (method, path, route) => {
    expect(matchAuditedResource(method, path)).toMatchObject({
      resource: { route, resourceType: "legal_document" },
      params: { kind: "return_policy" },
    })
  })

  it("leaves other routes to the generic entry", () => {
    expect(matchAuditedResource("POST", "/admin/regions/reg_01ABC")).toBeNull()
  })

  it("reads encoded IDs as Express decodes them", () => {
    const req = { originalUrl: "/admin/products/prod%5F01ABC/variants/variant%5F01X" }

    expect(auditPath(req as unknown as MedusaRequest)).toBe(
      "/admin/products/prod_01ABC/variants/variant_01X"
    )
  })

  it("snapshots the products a batch names in its body", async () => {
    const graph = jest.fn(() => Promise.resolve({ data: [] }))
    const match = matchAuditedResource("POST", "/admin/products/batch")

    await match?.resource.snapshot({
      scope: { resolve: () => ({ graph }) },
      params: match.params,
      body: { update: [{ id: "prod_1" }, { id: "prod_2" }], delete: ["prod_3"], create: [{}] },
    })

    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product",
        filters: { id: ["prod_1", "prod_2", "prod_3"] },
      })
    )
  })

  it("describes a route by its pattern, area and first ID", () => {
    expect(describeRoute("POST", "/admin/customers/cus_01ABC/addresses/cuaddr_01X")).toEqual({
      action: "POST /admin/customers/:id/addresses/:id",
      resourceType: "customer",
      resourceId: "cus_01ABC",
    })
    expect(describeRoute("POST", "/admin/store-credit-accounts/sc_acc_01X/debit")).toMatchObject({
      action: "POST /admin/store-credit-accounts/:id/debit",
      resourceId: "sc_acc_01X",
    })
    expect(describeRoute("POST", "/admin/products/batch")).toEqual({
      action: "POST /admin/products/batch",
      resourceType: "product",
      resourceId: null,
    })
    expect(describeRoute("POST", "/admin/product-categories")).toMatchObject({
      resourceType: "product_category",
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

  it("reads again after a failed request, which may have changed something", async () => {
    const graph = jest.fn(() => Promise.resolve({ data: [{ prices: [] }] }))
    const { req, record } = fakes({ path: "/admin/products/prod_1A/variants/variant_1B", graph })
    const res = finishingResponse(500)

    await auditMutations(req, res, jest.fn())
    res.emit("finish")
    await flush()

    expect(graph).toHaveBeenCalledTimes(2)
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 500, changes: { fields: [], diff: {} } })
    )
  })

  it("records a mutation whose client hung up before the answer", async () => {
    const { req, record } = fakes({ path: "/admin/regions", body: { name: "x" } })
    const res = finishingResponse(200)

    await auditMutations(req, res, jest.fn())
    // The handler ends the response; no "finish" comes on a closed socket
    res.end()
    await flush()

    expect(record).toHaveBeenCalledTimes(1)
    res.emit("finish")
    await flush()
    expect(record).toHaveBeenCalledTimes(1)
  })

  it("writes field names Postgres can store", async () => {
    const { req, record } = fakes({
      path: "/admin/regions",
      body: { name: "x", "\u0000": 1, ["a".repeat(65)]: 2 },
    })
    const res = finishingResponse(200)

    await auditMutations(req, res, jest.fn())
    res.end()
    await flush()

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { fields: ["name", "<invalid>", "<invalid>"] } })
    )
  })

  it("skips reads", async () => {
    const { req, record } = fakes({ path: "/admin/products", method: "GET" })
    const next = jest.fn()

    await auditMutations(req, finishingResponse(200), next)

    expect(next).toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
  })

  it("logs a failed write and retries it without the change summary", async () => {
    const record = jest
      .fn()
      .mockRejectedValueOnce(new Error("db refused"))
      .mockResolvedValueOnce({ id: "aud_1" })
    const { req } = fakes({ path: "/admin/regions", record })
    const res = finishingResponse(200)

    await auditMutations(req, res, jest.fn())
    res.emit("finish")
    await flush()
    await flush()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "audit.write_failed", action: "POST /admin/regions" })
    )
    expect(record).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "POST /admin/regions", changes: { write_failed: true } })
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

  it("records what a list read asked for, never filter values", async () => {
    const { req, record } = fakes({
      path: "/admin/customers",
      method: "GET",
      query: { fields: "*addresses", limit: "50", offset: "0", q: "Ayşe Yılmaz" },
    })

    await auditSensitiveRead("customer", { list: true })(req, fakeResponse().res, jest.fn())

    const entry = (record.mock.calls[0] as [Record<string, unknown>])[0]
    expect(entry).toMatchObject({
      action: "GET /admin/customers",
      resource_id: null,
      changes: {
        fields: "*addresses",
        limit: "50",
        offset: "0",
        params: ["fields", "limit", "offset", "q"],
      },
    })
    expect(JSON.stringify(entry)).not.toContain("Ayşe")
  })

  it("does not record a read asking only for fields without personal data", async () => {
    const read = auditSensitiveRead("notification", {
      list: true,
      safeFields: ["id", "created_at"],
    })
    const badge = fakes({
      path: "/admin/notifications",
      method: "GET",
      query: { fields: "created_at" },
    })
    const full = fakes({
      path: "/admin/notifications",
      method: "GET",
      query: { fields: "created_at,to" },
    })
    const next = jest.fn()

    await read(badge.req, fakeResponse().res, next)
    await read(full.req, fakeResponse().res, next)

    expect(next).toHaveBeenCalledTimes(2)
    expect(badge.record).not.toHaveBeenCalled()
    expect(full.record).toHaveBeenCalledTimes(1)
  })

  it("takes the resource ID from the decoded route parameter", async () => {
    const { req, record } = fakes({
      path: "/admin/customers/cus%5F01A",
      method: "GET",
      params: { id: "cus_01A" },
    })

    await auditSensitiveRead("customer")(req, fakeResponse().res, jest.fn())

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ resource_id: "cus_01A" }))
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

describe("requireUserActor", () => {
  it.each([
    ["a secret API key", { actor_type: "api-key", actor_id: "apk_1" }],
    ["no actor", undefined],
  ])("refuses %s", (_label, auth) => {
    const req = { auth_context: auth, method: "GET", originalUrl: "/admin/audit-log" }
    const response = fakeResponse()
    const next = jest.fn()

    requireUserActor(req as unknown as MedusaRequest, response.res, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.status()).toBe(403)
  })

  it("lets a signed-in user through", () => {
    const next = jest.fn()
    const req = { auth_context: { actor_type: "user", actor_id: "user_1" } }

    requireUserActor(req as unknown as MedusaRequest, fakeResponse().res, next)

    expect(next).toHaveBeenCalled()
  })
})
