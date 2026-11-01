import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { resetClientIpSecret } from "../../src/api/http/client-ip"
import { BASE_BITS } from "../../src/lib/security/challenge"
import { CLIENT_IP_HEADERS, signClientIp } from "../../src/lib/security/client-ip"
import { freshChallenge } from "../helpers/challenge"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// Read lazily by `clientIp`, so setting it before the first request is enough
const SECRET = `storefront-ip-${randomUUID()}`
process.env["STOREFRONT_IP_SECRET"] = SECRET

const signedAs = (ip: string, secret = SECRET): Record<string, string> => {
  const time = Math.floor(Date.now() / 1000)
  return {
    [CLIENT_IP_HEADERS.ip]: ip,
    [CLIENT_IP_HEADERS.time]: String(time),
    [CLIENT_IP_HEADERS.signature]: signClientIp(secret, ip, time),
  }
}

/**
 * F18 (adr/0046 §5): the storefront's server signs the shopper's address and
 * limits count that address, not the storefront's.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api }) => {
    const http = api as HttpClient

    beforeAll(() => {
      resetClientIpSecret()
    })

    it("counts a login limit per signed address and ignores a forged one", async () => {
      const email = `nobody-${randomUUID()}@example.com`
      const attempt = (headers: Record<string, string>) =>
        settle(
          http.post(
            "/auth/customer/emailpass",
            { email, password: `wrong-${randomUUID()}` },
            // Past twice the soft limit for one e-mail the proof of work is harder
            { headers: { ...freshChallenge("login", BASE_BITS + 2), ...headers } }
          )
        )

      const shopper = "203.0.113.10"
      for (let index = 0; index < 10; index++) {
        expect((await attempt(signedAs(shopper))).status).toBe(401)
      }
      expect((await attempt(signedAs(shopper))).status).toBe(429)

      // Another shopper behind the same storefront is not held back
      expect((await attempt(signedAs("203.0.113.11"))).status).toBe(401)
      // A signature made without the secret is ignored: the connection's own
      // address counts, which has no failures yet
      expect((await attempt(signedAs(shopper, `${SECRET}-forged`))).status).toBe(401)
    })
  },
})
