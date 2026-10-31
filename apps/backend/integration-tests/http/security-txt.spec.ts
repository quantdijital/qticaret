import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

/** F15.9 (RFC 9116): the shop's security.txt, for the storefront's `/.well-known/`. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    afterEach(() => {
      delete process.env["SECURITY_CONTACT"]
    })

    it("answers 404 until a contact is set, then the file as plain text", async () => {
      const { headers } = await createStorefront(getContainer())
      const ask = () =>
        settle(http.get<string>("/store/seo/security", { headers, responseType: "text" }))

      const unset = await ask()
      process.env["SECURITY_CONTACT"] = "mailto:guvenlik@example.com"
      const set = await ask()

      expect(unset.status).toBe(404)
      expect(set.status).toBe(200)
      expect(set.headers["content-type"]).toMatch(/^text\/plain/)
      expect(set.data).toMatch(/^Contact: mailto:guvenlik@example\.com\nExpires: \S+Z\n/)
    })
  },
})
