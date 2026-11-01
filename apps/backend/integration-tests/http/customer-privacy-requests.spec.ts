import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Answer {
  privacy_request: { id: string; kind: string; status: string; due_at: string }
}

/** F18 D8 (adr/0041 §6): a customer asks for their data or its erasure from their account. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("records a request from the account once, lists it, and shows it to the shop", async () => {
      const store = await createStorefront(getContainer())
      const customer = await registerCustomer(http, store)
      const ask = (kind: string, headers: Record<string, string> = customer.headers) =>
        settle(http.post<Answer>("/store/customers/me/privacy-requests", { kind }, { headers }))

      const first = await ask("export")
      expect(first.status).toBe(201)
      expect(first.data.privacy_request).toMatchObject({ kind: "export", status: "open" })
      // Asking twice opens nothing new
      const again = await ask("export")
      expect([again.status, again.data.privacy_request.id]).toEqual([
        200,
        first.data.privacy_request.id,
      ])
      // Two at once (a double submit): still one request
      const [one, two] = await Promise.all([ask("erasure"), ask("erasure")])
      expect([one.status, two.status].sort()).toEqual([200, 201])
      expect(one.data.privacy_request.id).toBe(two.data.privacy_request.id)
      expect((await ask("everything")).status).toBe(400)

      const list = await settle(
        http.get<{ privacy_requests: { kind: string }[] }>("/store/customers/me/privacy-requests", {
          headers: customer.headers,
        })
      )
      expect(list.data.privacy_requests.map((row) => row.kind).sort()).toEqual([
        "erasure",
        "export",
      ])

      // A guest has no account to ask from
      expect((await ask("export", store.headers)).status).toBe(401)

      // The shop sees it where staff-recorded ones are, by the channel it came from
      const admin = await createAdminUser(http, getContainer())
      const shop = await settle(
        http.get<{ privacy_requests: { channel: string; recorded_by: string }[] }>(
          `/admin/customers/${customer.id}/privacy-requests`,
          { headers: admin.headers }
        )
      )
      expect(shop.data.privacy_requests).toHaveLength(2)
      expect(shop.data.privacy_requests.every((row) => row.channel === "account")).toBe(true)
      expect(shop.data.privacy_requests[0]?.recorded_by).toBe(customer.id)
    })
  },
})
