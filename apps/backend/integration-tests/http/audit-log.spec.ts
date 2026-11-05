import { randomUUID } from "node:crypto"
import { connect } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import { createAdminUser } from "../helpers/admin"
import { INDIVIDUAL, saveProfile } from "../helpers/billing-profile"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"

jest.setTimeout(120 * 1000)

interface AuditEntry {
  kind: string
  action: string
  actor_type: string | null
  actor_id: string | null
  resource_type: string | null
  resource_id: string | null
  outcome: number | null
  changes: { fields?: string[]; diff?: Record<string, unknown> } | null
  request_id: string | null
}

/** F2.5 (adr/0011): admin mutations and personal data reads are recorded. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let storefront: Storefront

    // Mutations are written once the response has finished, so they may
    // land a moment after it
    async function entries(params: Record<string, string>): Promise<AuditEntry[]> {
      const search = new URLSearchParams(params).toString()
      for (let attempt = 0; attempt < 30; attempt++) {
        const { data } = await http.get<{ audit_entries: AuditEntry[] }>(
          `/admin/audit-log?${search}`,
          { headers: admin.headers }
        )
        if (data.audit_entries.length > 0) {
          return data.audit_entries
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return []
    }

    async function productOf(variantId: string): Promise<string> {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: ["product_id"],
        filters: { id: variantId },
      })
      return (data[0] as { product_id: string }).product_id
    }

    // A raw HTTP/1.1 request: clients normalise paths and wait for answers;
    // these tests need neither. `hangUp` closes as soon as the request is out.
    function rawRequest(lines: string[], body: string, hangUp: boolean): Promise<string> {
      const base = new URL((api as { defaults: { baseURL: string } }).defaults.baseURL)
      return new Promise((resolve, reject) => {
        const socket = connect(Number(base.port), base.hostname)
        let answer = ""
        socket.on("data", (chunk: Buffer) => {
          answer += chunk.toString()
        })
        socket.on("close", () => {
          resolve(answer)
        })
        socket.on("error", reject)
        const head = [
          ...lines,
          `Host: ${base.host}`,
          `Content-Length: ${String(Buffer.byteLength(body))}`,
        ]
        socket.write(`${head.join("\r\n")}\r\n\r\n${body}`, () => {
          if (hangUp) {
            socket.destroy()
          } else {
            socket.end()
          }
        })
      })
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      storefront = await createStorefront(getContainer())
    })

    it("records a variant price change with its price before and after (F2 KK)", async () => {
      const variantId = await createTestProduct(getContainer(), storefront.salesChannelId, {
        handle: `bicak-${randomUUID()}`,
        price: 1000,
      })
      const productId = await productOf(variantId)

      const update = await http.post(
        `/admin/products/${productId}/variants/${variantId}`,
        { prices: [{ currency_code: "try", amount: 1250 }] },
        { headers: admin.headers }
      )
      const [entry] = await entries({ resource_id: variantId, kind: "mutation" })

      expect(update.status).toBe(200)
      expect(entry).toMatchObject({
        action: "POST /admin/products/:id/variants/:variant_id",
        actor_type: "user",
        resource_type: "product_variant",
        outcome: 200,
        changes: { fields: ["prices"] },
      })
      expect(entry?.actor_id).toMatch(/^user_/)
      const diff = JSON.stringify(entry?.changes?.diff)
      expect(diff).toContain('"before":"1000 try"')
      expect(diff).toContain('"after":"1250 try"')
    })

    it("records a price change made through the product, as the dashboard does", async () => {
      const variantId = await createTestProduct(getContainer(), storefront.salesChannelId, {
        handle: `bicak-${randomUUID()}`,
        price: 2000,
      })
      const productId = await productOf(variantId)

      await http.post(
        `/admin/products/${productId}`,
        { variants: [{ id: variantId, prices: [{ currency_code: "try", amount: 1800 }] }] },
        { headers: admin.headers }
      )
      const [entry] = await entries({ resource_id: productId, kind: "mutation" })

      expect(entry).toMatchObject({ action: "POST /admin/products/:id", resource_type: "product" })
      const diff = JSON.stringify(entry?.changes?.diff)
      expect(diff).toContain(`variant:${variantId}:price:`)
      expect(diff).toContain('"before":"2000 try"')
      expect(diff).toContain('"after":"1800 try"')
    })

    it("records an admin viewing a customer's billing profile (F2 KK)", async () => {
      const customer = await registerCustomer(http, storefront)
      await saveProfile(http, customer, INDIVIDUAL)

      const view = await http.get(`/admin/customers/${customer.id}/billing-profile`, {
        headers: admin.headers,
      })
      const [entry] = await entries({ resource_id: customer.id, kind: "sensitive_read" })

      expect(view.status).toBe(200)
      expect(entry).toMatchObject({
        action: "GET /admin/customers/:id/billing-profile",
        resource_type: "customer",
        actor_type: "user",
      })
      expect(entry?.request_id).toBe(view.headers["x-request-id"])
    })

    it("records a secret API key as the actor and other routes by field names only", async () => {
      // A key reaches its scopes' routes only (F11.6): a webhook it may open
      const made = await http.post<{ key: { id: string }; token: string }>(
        "/admin/api-access",
        { title: "integration", scopes: ["webhooks:manage", "catalog:read"] },
        { headers: admin.headers }
      )
      const secretPath = `gizli-${randomUUID()}`

      const created = await settle(
        http.post(
          "/admin/webhooks",
          { url: `https://hooks.example.com/${secretPath}`, events: ["stock.changed"] },
          {
            headers: {
              authorization: `Basic ${Buffer.from(`${made.data.token}:`).toString("base64")}`,
            },
          }
        )
      )
      const [entry] = await entries({ actor_id: made.data.key.id, kind: "mutation" })

      expect(created.status).toBe(201)
      expect(entry).toMatchObject({
        action: "POST /admin/webhooks",
        actor_type: "api-key",
        changes: { fields: ["url", "events"] },
      })
      expect(JSON.stringify(entry)).not.toContain(secretPath)
    })

    it("records reading the audit log itself, and pages at most 100 entries", async () => {
      await http.get("/admin/audit-log", { headers: admin.headers })
      const [entry] = await entries({ resource_type: "audit_log" })
      const tooMany = await settle(
        http.get("/admin/audit-log?limit=101", { headers: admin.headers })
      )

      expect(entry).toMatchObject({ kind: "sensitive_read", action: "GET /admin/audit-log" })
      expect(tooMany.status).toBe(400)
    })

    it("records a list read with what it asked for, and refuses tax id expansions", async () => {
      await http.get("/admin/customers?fields=email,*addresses&limit=20", {
        headers: admin.headers,
      })
      const expansion = await settle(
        http.get("/admin/customers/cus_01ABC?fields=*billing_profile", { headers: admin.headers })
      )
      const [entry] = await entries({ resource_type: "customer", kind: "sensitive_read" })

      expect(entry).toMatchObject({
        action: "GET /admin/customers",
        resource_id: null,
        changes: { fields: "email,*addresses", limit: "20" },
      })
      expect(expansion.status).toBe(400)
    })

    it("filters by who: a person, an integration's key or the platform; and lists what it has entries for", async () => {
      const container = getContainer()
      const log = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      await log.record({ kind: "system", action: "seo.sitemap_built", actor_type: "system" })
      await log.record({
        kind: "mutation",
        action: "POST /admin/webhooks",
        actor_type: "api-key",
        actor_id: "apk_1",
        resource_type: "webhook",
      })
      const ops = await createAdminUser(http, container, "operations")
      const list = (params: Record<string, string>) =>
        settle(
          http.get<{ audit_entries: AuditEntry[] }>(
            `/admin/audit-log?${new URLSearchParams(params).toString()}`,
            { headers: admin.headers }
          )
        )

      const byKey = await list({ actor_type: "api-key" })
      const bySystem = await list({ actor_type: "system" })
      const unknown = await list({ actor_type: "robot" })
      // A made-up path is recorded, but names no kind of thing for the filter
      await settle(http.post("/admin/uydurma-alan", {}, { headers: admin.headers }))
      const types = await http.get<{ resource_types: string[] }>(
        "/admin/audit-log/resource-types",
        { headers: admin.headers }
      )
      const typesByOps = await settle(
        http.get("/admin/audit-log/resource-types", { headers: ops.headers })
      )

      expect(byKey.data.audit_entries.map(({ actor_id }) => actor_id)).toEqual(["apk_1"])
      expect(bySystem.data.audit_entries.map(({ action }) => action)).toContain("seo.sitemap_built")
      expect(unknown.status).toBe(400)
      // Reading the log is recorded as an `audit_log` entry: it is in the list too
      expect(types.data.resource_types).toEqual(expect.arrayContaining(["audit_log", "webhook"]))
      expect(types.data.resource_types).not.toContain("uydurma_alan")
      expect(typesByOps.status).toBe(403)
    })

    it("leaves the platform operator's entries out of the shop's list, filter and export", async () => {
      const container = getContainer()
      const log = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      // As the weekly address sync writes it (adr/0008 Ek 2026-11-04)
      await log.record({
        kind: "system",
        action: "tr_address.imported",
        actor_type: "system",
        resource_type: "tr_address",
        resource_id: "trsync_1",
      })
      await log.record({ kind: "system", action: "shop.kept", actor_type: "system" })
      const list = (params: Record<string, string>) =>
        http.get<{ audit_entries: AuditEntry[]; count: number }>(
          `/admin/audit-log?${new URLSearchParams(params).toString()}`,
          { headers: admin.headers }
        )

      const all = (await list({ actor_type: "system" })).data
      const asked = (await list({ resource_type: "tr_address" })).data
      const types = await http.get<{ resource_types: string[] }>(
        "/admin/audit-log/resource-types",
        { headers: admin.headers }
      )
      const queued = await http.post<{ async_job: { id: string } }>(
        "/admin/async-jobs",
        { type: "audit_log.export", input: { resource_type: "tr_address" } },
        { headers: admin.headers }
      )
      let summary: { rows?: number } | null = null
      for (let attempt = 0; attempt < 50 && summary === null; attempt++) {
        const { data } = await http.get<{
          async_job: { status: string; result_summary: { rows?: number } | null }
        }>(`/admin/async-jobs/${queued.data.async_job.id}`, { headers: admin.headers })
        summary = data.async_job.status === "succeeded" ? data.async_job.result_summary : null
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const actions = all.audit_entries.map(({ action }) => action)
      expect(actions).toContain("shop.kept")
      expect(actions).not.toContain("tr_address.imported")
      expect(all.count).toBe(all.audit_entries.length)
      expect(asked).toMatchObject({ audit_entries: [], count: 0 })
      expect(types.data.resource_types).not.toContain("tr_address")
      expect(summary?.rows).toBe(0)
      // The record stays for the operator
      const [kept] = await log.listAuditEntries({ resource_type: "tr_address" })
      expect(kept?.action).toBe("tr_address.imported")
    })

    it("keeps the audit log from secret API keys", async () => {
      const { result } = await createApiKeysWorkflow(getContainer()).run({
        input: { api_keys: [{ title: "integration", type: "secret", created_by: "user_test" }] },
      })
      const basic = Buffer.from(`${result[0]?.token ?? ""}:`).toString("base64")

      const read = await settle(
        http.get("/admin/audit-log", { headers: { authorization: `Basic ${basic}` } })
      )

      expect(read.status).toBe(403)
    })

    it("records a mutation whose client hangs up before the answer", async () => {
      const name = `Kopan Bağlantı ${randomUUID()}`
      const body = JSON.stringify({ name, currency_code: "try" })

      await rawRequest(
        [
          "POST /admin/regions HTTP/1.1",
          `Authorization: ${admin.headers["authorization"] ?? ""}`,
          "Content-Type: application/json",
        ],
        body,
        true
      )
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      let regionId: string | undefined
      for (let attempt = 0; attempt < 30 && !regionId; attempt++) {
        const { data } = await query.graph({ entity: "region", fields: ["id"], filters: { name } })
        regionId = (data[0] as { id: string } | undefined)?.id
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      const recorded = await entries({ resource_type: "region", kind: "mutation" })

      expect(regionId).toBeDefined()
      expect(recorded.some((entry) => entry.action === "POST /admin/regions")).toBe(true)
    })

    it("refuses a request target with a backslash or a fragment", async () => {
      const answer = await rawRequest(
        [
          "POST /auth\\customer\\emailpass\\reset-password# HTTP/1.1",
          "Content-Type: application/json",
        ],
        JSON.stringify({ identifier: "kurban@example.com" }),
        false
      )

      expect(answer.split("\r\n")[0]).toContain(" 400 ")
    })
  },
})
