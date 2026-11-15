import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { resetClientIpSecret } from "../../src/api/http/client-ip"
import { CLIENT_IP_HEADERS, signClientIp } from "../../src/lib/security/client-ip"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { adminOrigin, sessionCookie } from "../helpers/staff-account"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

// The profiles at their real size here (integration tests grow per-IP
// limits a hundredfold): read when the app's middlewares are made
process.env["RATE_LIMIT_RELAXED"] = "0"
// The storefront signs its visitor's address; read lazily by `clientIp`
const IP_SECRET = `editor-session-limits-${randomUUID()}`
process.env["STOREFRONT_IP_SECRET"] = IP_SECRET

const signedAs = (ip: string): Record<string, string> => {
  const time = Math.floor(Date.now() / 1000)
  return {
    [CLIENT_IP_HEADERS.ip]: ip,
    [CLIENT_IP_HEADERS.time]: String(time),
    [CLIENT_IP_HEADERS.signature]: signClientIp(IP_SECRET, ip, time),
  }
}

/**
 * adr/0065 §1, security review 2026-11-15: the live preview session's two
 * rate limits. The storefront's read (`layout_session`) is 120 a minute
 * per visitor address; opening one (`layout_session_open`) is 60 an hour
 * per staff member, from any address.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    beforeAll(() => {
      resetClientIpSecret()
    })

    it("answers 429 past 120 reads a minute from one address, others unaffected", async () => {
      const store = await createStorefront(getContainer())
      const read = (ip: string) =>
        settle(
          http.get("/store/storefront-layout/session/sfs_guess", {
            headers: { ...store.headers, ...signedAs(ip) },
          })
        )
      const statuses: number[] = []
      for (let batch = 0; batch < 4; batch++) {
        const answers = await Promise.all(Array.from({ length: 30 }, () => read("203.0.113.70")))
        statuses.push(...answers.map(({ status }) => status))
      }
      const over = await read("203.0.113.70")
      const other = await read("203.0.113.71")

      // A guessed token finds nothing, until the limit stops it
      expect(statuses.filter((status) => status !== 404)).toEqual([])
      expect(over.status).toBe(429)
      expect(Number(over.headers["retry-after"])).toBeGreaterThan(0)
      expect(other.status).toBe(404)
    })

    it("answers 429 past 60 sessions opened an hour by one staff member", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const admin = await createAdminUser(http, container, "admin")
      await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [] } },
          { headers: owner.headers }
        )
      )
      const browser = async (bearer: Record<string, string>) => ({
        cookie: sessionCookie(await http.post("/auth/session", {}, { headers: bearer })),
        origin: adminOrigin(),
      })
      const mine = await browser(owner.plain)
      const open = (headers: Record<string, string>) =>
        settle(http.post("/admin/storefront-layout/editor-session", {}, { headers }))

      const statuses: number[] = []
      for (let index = 0; index < 60; index++) {
        statuses.push((await open(mine)).status)
      }
      const over = await open(mine)
      // Another panel session of the same member counts with the first
      const elsewhere = await open(await browser(owner.plain))
      const theirs = await open(await browser(admin.plain))

      expect(statuses.filter((status) => status !== 200)).toEqual([])
      expect(over.status).toBe(429)
      expect(Number(over.headers["retry-after"])).toBeGreaterThan(0)
      expect(elsewhere.status).toBe(429)
      expect(theirs.status).toBe(200)
    })
  },
})
