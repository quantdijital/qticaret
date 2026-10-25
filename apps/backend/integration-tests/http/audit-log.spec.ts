import { randomUUID } from "node:crypto"
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
      const { result } = await createApiKeysWorkflow(getContainer()).run({
        input: { api_keys: [{ title: "integration", type: "secret", created_by: "user_test" }] },
      })
      const token = result[0]?.token ?? ""
      const name = `Gizli Bölge ${randomUUID()}`

      const created = await http.post<{ region: { id: string } }>(
        "/admin/regions",
        { name, currency_code: "try" },
        { headers: { authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}` } }
      )
      const [entry] = await entries({ actor_id: result[0]?.id ?? "", kind: "mutation" })

      expect(created.status).toBe(200)
      expect(entry).toMatchObject({
        action: "POST /admin/regions",
        actor_type: "api-key",
        changes: { fields: ["name", "currency_code"] },
      })
      expect(JSON.stringify(entry)).not.toContain("Gizli")
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
  },
})
