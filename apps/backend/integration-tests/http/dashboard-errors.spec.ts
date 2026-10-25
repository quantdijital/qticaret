import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface ErrorBody {
  code?: string
  message: string
}

function sessionCookie(response: HttpResponse<unknown>): string {
  const header = response.headers["set-cookie"]
  const cookies = Array.isArray(header) ? header : header ? [header] : []
  const cookie = cookies.find((value) => value.startsWith("connect.sid="))
  if (!cookie) {
    throw new Error("no session cookie was set")
  }
  return cookie.split(";")[0] ?? ""
}

/**
 * adr/0021: the dashboard prints an error's message as it is, so a request
 * it makes (session cookie, no Authorization) gets our sentence, with the
 * key in `code`; API clients keep the key as the message.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let bearer: Record<string, string>
    let cookie: Record<string, string>

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      bearer = admin.headers
      cookie = { cookie: sessionCookie(await http.post("/auth/session", {}, { headers: bearer })) }
    })

    const get = (url: string, headers: Record<string, string>) =>
      settle(http.get<ErrorBody>(url, { headers }))

    it("answers the dashboard with the sentence from a middleware's refusal", async () => {
      const dashboard = await get("/admin/products?limit=10000", cookie)
      const client = await get("/admin/products?limit=10000", bearer)

      expect(dashboard.status).toBe(400)
      expect(dashboard.data).toMatchObject({
        code: "errors.limit_too_large",
        message: "Tek seferde bu kadar çok kayıt istenemez.",
      })
      expect(client.data).toMatchObject({ message: "errors.limit_too_large" })
    })

    it("answers the dashboard with the sentence from a thrown error", async () => {
      const dashboard = await get("/admin/products/prod_unknown/catalog", cookie)
      const client = await get("/admin/products/prod_unknown/catalog", bearer)

      expect(dashboard.status).toBe(404)
      expect(dashboard.data).toMatchObject({
        code: "catalog.product_unknown",
        message: "Ürün bulunamadı.",
      })
      expect(client.data.message).toBe("catalog.product_unknown")
    })
  },
})
