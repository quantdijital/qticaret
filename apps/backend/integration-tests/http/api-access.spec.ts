import { request as httpRequest } from "node:http"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { captureOutput } from "../helpers/logs"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(120 * 1000)

interface MadeKey {
  key: { id: string; redacted: string; scopes: string[]; revoked_at: string | null }
  token: string
}

const basic = (token: string) => ({
  authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
})

/** F11.6 (adr/0039 §6; KK4): API keys reach only their scopes, and a revoked one nothing. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    const make = async (scopes: string[], title = "Depo programı") =>
      (
        await settle(
          http.post<MadeKey>("/admin/api-access", { title, scopes }, { headers: admin.headers })
        )
      ).data
    const call = (method: "get" | "post", url: string, token: string, body: unknown = {}) =>
      settle(
        method === "get"
          ? http.get(url, { headers: basic(token) })
          : http.post(url, body, { headers: basic(token) })
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    it("lets a key reach its scopes only; every other admin route stays closed", async () => {
      const made = await make(["orders:read"])
      const listed = await http.get<{ keys: { id: string; scopes: string[]; redacted: string }[] }>(
        "/admin/api-access",
        { headers: admin.headers }
      )

      const orders = await call("get", "/admin/orders?limit=5", made.token)
      const products = await call("get", "/admin/products", made.token)
      const users = await call("get", "/admin/users", made.token)
      const keys = await call("get", "/admin/api-access", made.token)
      const newKey = await call("post", "/admin/api-keys", made.token, {
        title: "x",
        type: "secret",
      })

      expect(made.token).toMatch(/^sk_/)
      expect(listed.data.keys).toEqual([
        { ...made.key, created_at: expect.any(String) as unknown, title: "Depo programı" },
      ])
      expect(JSON.stringify(listed.data)).not.toContain(made.token)
      expect(orders.status).toBe(200)
      expect([products.status, users.status, keys.status, newKey.status]).toEqual([
        403, 403, 403, 403,
      ])
    })

    it("closes everything to a key made without scopes, and writes stock with the stock scope", async () => {
      const bare = await settle(
        http.post<{ api_key: { token: string } }>(
          "/admin/api-keys",
          { title: "Kapsamsız", type: "secret" },
          { headers: admin.headers }
        )
      )
      const { itemId } = await stockedProduct(getContainer(), shop, "api-kupa", 3)
      const writer = await make(["stock:write", "catalog:read"], "Depo")

      const closed = await call("get", "/admin/orders", bare.data.api_key.token)
      const written = await call(
        "post",
        `/admin/inventory-items/${itemId}/location-levels/${shop.locationId}`,
        writer.token,
        { stocked_quantity: 11 }
      )
      const read = await call("get", `/admin/inventory-items/${itemId}`, writer.token)

      expect(closed.status).toBe(403)
      expect(written.status).toBe(200)
      expect(read.status).toBe(200)
    })

    it("judges the path Express routes, and lets a key name no fields", async () => {
      const reader = await make(["orders:read", "catalog:read"])
      // The path as written, never folded by a client's URL parser
      const raw = (path: string) =>
        new Promise<number>((resolve, reject) => {
          const base = new URL((api as { defaults: { baseURL: string } }).defaults.baseURL)
          const req = httpRequest(
            {
              hostname: base.hostname,
              port: base.port,
              path,
              method: "GET",
              headers: basic(reader.token),
            },
            (res) => {
              res.resume()
              resolve(res.statusCode ?? 0)
            }
          )
          req.on("error", reject)
          req.end()
        })

      const escaped = await raw("/admin/gift-cards/%2e%2e/orders")
      const dotted = await raw("/admin/gift-cards/../orders")
      const plain = await raw("/admin/orders")
      const cost = await call(
        "get",
        "/admin/products?fields=*variants.variant_extension",
        reader.token
      )
      const payments = await call(
        "get",
        "/admin/orders?fields=+payment_collections.payments.data",
        reader.token
      )
      // A person may still pick fields
      const staff = await settle(
        http.get("/admin/products?fields=id,title", { headers: admin.headers })
      )

      expect([escaped, dotted]).toEqual([400, 400])
      expect(plain).toBe(200)
      expect([cost.status, payments.status]).toEqual([400, 400])
      expect(cost.data).toMatchObject({ message: "api_key.fields_not_allowed" })
      expect(staff.status).toBe(200)
    })

    it("refuses a revoked key at once, and never logs a key (KK4)", async () => {
      const made = await make(["orders:read"])
      let before = 0
      let after = 0
      const output = await captureOutput(async () => {
        before = (await call("get", "/admin/orders", made.token)).status
        await settle(
          http.post(`/admin/api-access/${made.key.id}/revoke`, {}, { headers: admin.headers })
        )
        after = (await call("get", "/admin/orders", made.token)).status
      })
      const again = await settle(
        http.post(`/admin/api-access/${made.key.id}/revoke`, {}, { headers: admin.headers })
      )

      expect(before).toBe(200)
      expect(after).toBe(401)
      expect(again.status).toBe(200)
      expect(output).not.toContain(made.token)
      expect(output).not.toContain(made.token.slice(3))
    })

    it("refuses a key without a scope or a name, and describes what keys reach", async () => {
      const none = await settle(
        http.post("/admin/api-access", { title: "Boş", scopes: [] }, { headers: admin.headers })
      )
      const unknown = await settle(
        http.post(
          "/admin/api-access",
          { title: "Her şey", scopes: ["admin:all"] },
          { headers: admin.headers }
        )
      )
      const doc = await http.get<{ paths: Record<string, Record<string, { "x-scope": string }>> }>(
        "/admin/openapi.json",
        { headers: admin.headers }
      )

      expect(none.status).toBe(400)
      expect(unknown.status).toBe(400)
      expect(doc.data.paths["/admin/orders"]?.["get"]?.["x-scope"]).toBe("orders:read")
      expect(doc.data.paths["/admin/users"]).toBeUndefined()
    })
  },
})
