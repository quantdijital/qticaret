import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface Answer {
  consent: {
    necessary: boolean
    analytics: boolean
    marketing: boolean
    policy_version: number | null
  } | null
  policy_version?: number | null
  message?: string
}

/** F13.8 (adr/0041 §5): the cookie banner's answers, by the storefront's own visitor cookie. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("keeps each answer under the policy shown, and holds the cart's measurement to the latest", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const store = await createStorefront(container)
      const owner = await createAdminUser(http, container)
      const variantId = (
        await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 5, 100)
      ).variantId
      const as = (cookie?: string) => ({ ...store.headers, ...(cookie ? { cookie } : {}) })
      const answer = (body: Record<string, unknown>, cookie?: string) =>
        settle(http.post<Answer>("/store/consents/cookies", body, { headers: as(cookie) }))
      const read = (cookie?: string) =>
        settle(http.get<Answer>("/store/consents/cookies", { headers: as(cookie) }))

      const stranger = await read()
      const wrongPolicy = await answer({ analytics: true, marketing: true, policy_version: 1 })
      const first = await answer({ analytics: true, marketing: true, policy_version: null })
      const setCookie = String(first.headers["set-cookie"] ?? "")
      const cookie = setCookie.split(";")[0] ?? ""
      const known = await read(cookie)

      await http.post(
        "/admin/legal-documents/cookie_policy/draft",
        {
          title: "Çerez politikası",
          body: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Çerezler." }] }],
          },
        },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/legal-documents/cookie_policy/publish",
        {},
        { headers: owner.headers }
      )
      const askAgain = await read(cookie)
      const oldPolicy = await answer(
        { analytics: true, marketing: true, policy_version: null },
        cookie
      )
      const withdrawn = await answer(
        { analytics: true, marketing: false, policy_version: 1 },
        cookie
      )

      const cartId = await readyCart(container, shop, variantId)
      const held = await settle(
        http.post<{ tracking: { analytics: boolean; marketing: boolean } }>(
          `/store/carts/${cartId}/tracking`,
          { analytics: true, marketing: true, fbp: "fb.1.1793260000000.1234567890" },
          { headers: as(cookie) }
        )
      )
      const unanswered = await settle(
        http.post<{ message?: string }>(`/store/carts/${cartId}/tracking`, {}, { headers: as() })
      )

      expect(stranger.data).toEqual({ consent: null, policy_version: null })
      expect(wrongPolicy.status).toBe(409)
      expect(first.status).toBe(200)
      expect(setCookie).toMatch(
        /^qt_vid=[A-Za-z0-9_-]{32}; Path=\/; Max-Age=\d+; HttpOnly; SameSite=Lax$/
      )
      expect(known.data.consent).toMatchObject({
        necessary: true,
        analytics: true,
        marketing: true,
      })
      // Answered under no policy, one published since: the banner asks again
      expect(askAgain.data).toMatchObject({ policy_version: 1, consent: { policy_version: null } })
      expect(oldPolicy.data.message).toBe("legal.version_changed")
      expect(withdrawn.status).toBe(200)
      expect(String(withdrawn.headers["set-cookie"])).toContain(cookie)
      expect(held.data.tracking).toEqual({ analytics: true, marketing: false })
      expect(unanswered.status).toBe(400)
      expect(unanswered.data.message).toBe("legal.cookie_consent_missing")
    })
  },
})
