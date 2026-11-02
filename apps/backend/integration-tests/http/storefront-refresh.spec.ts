import { createHmac, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingHttpHeaders, Server, ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { REFRESH_HEADERS } from "../../src/lib/storefront/refresh"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { captureOutput } from "../helpers/logs"

jest.setTimeout(120 * 1000)

// Read when a signal leaves: set before any. Generated per run (docs/04)
const SECRET = `storefront-refresh-${randomUUID()}`
const ENV_KEYS = ["STOREFRONT_IP_SECRET", "STOREFRONT_ORIGIN", "QT_TEST_STOREFRONT_REFRESH"]
const before = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
process.env["STOREFRONT_IP_SECRET"] = SECRET
// Off under NODE_ENV=test unless a test turns it on
process.env["QT_TEST_STOREFRONT_REFRESH"] = "1"

interface Received {
  method: string
  url: string
  headers: IncomingHttpHeaders
  body: { scopes: string[]; at: number; nonce: string }
}

type Answer = number | "hang"

/** The signal as the storefront checks it: the time in both places, recent, signed. */
function expectSigned(call: Received | undefined, scopes: string[]): void {
  const time = String(call?.headers[REFRESH_HEADERS.time])
  const body = call?.body
  expect(call).toMatchObject({ method: "POST", url: "/api/yenile" })
  expect(call?.headers["content-type"]).toBe("application/json")
  expect(body).toMatchObject({ scopes, at: Number(time) })
  expect(body?.nonce).toMatch(/^[0-9a-f]{32}$/)
  expect(Math.abs(Date.now() / 1000 - Number(time))).toBeLessThanOrEqual(60)
  const signature = createHmac("sha256", SECRET)
    .update(`${time}.${body?.nonce ?? ""}.${scopes.join(",")}`)
    .digest("hex")
  expect(call?.headers[REFRESH_HEADERS.signature]).toBe(signature)
}

/** adr/0048 ek 2026-11-03: a publication or a settings save reaches the storefront at once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let receiver: Server
    let admin: { headers: Record<string, string> }
    const received: Received[] = []
    const held: ServerResponse[] = []
    let answers: Answer[] = []

    const saveDraft = () =>
      settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [] } },
          { headers: admin.headers }
        )
      )
    const publish = () =>
      settle(http.post("/admin/storefront-layout/publish", {}, { headers: admin.headers }))
    const arrived = (count: number) =>
      eventually(
        () => Promise.resolve(received.length),
        (length) => length >= count,
        60
      )

    beforeAll(async () => {
      receiver = createServer((req, res) => {
        let body = ""
        req.on("data", (chunk: Buffer) => (body += chunk.toString()))
        req.on("end", () => {
          received.push({
            method: req.method ?? "",
            url: req.url ?? "",
            headers: req.headers,
            body: JSON.parse(body) as Received["body"],
          })
          const answer = answers.shift() ?? 204
          if (answer === "hang") {
            held.push(res)
          } else {
            res.writeHead(answer).end()
          }
        })
      })
      await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve))
      process.env["STOREFRONT_ORIGIN"] =
        `http://127.0.0.1:${String((receiver.address() as AddressInfo).port)}`
    })

    afterAll(async () => {
      held.forEach((res) => res.destroy())
      await new Promise((resolve) => receiver.close(resolve))
      for (const key of ENV_KEYS) {
        if (before[key] === undefined) {
          Reflect.deleteProperty(process.env, key)
        } else {
          process.env[key] = before[key]
        }
      }
    })

    beforeEach(async () => {
      received.length = 0
      answers = []
      admin = await createAdminUser(http, getContainer())
    })

    it("signals a published design and a saved storefront section, each with its scopes", async () => {
      expect((await saveDraft()).status).toBe(200)
      // A draft is for the editor's preview: nothing to tell the storefront
      expect(received).toHaveLength(0)

      expect((await publish()).status).toBe(200)
      await arrived(1)
      expectSigned(received[0], ["layout"])

      const saved = await settle(
        http.post(
          "/admin/platform-settings/storefront",
          { primary_color: "#0B5C99" },
          { headers: admin.headers }
        )
      )
      expect(saved.status).toBe(200)
      await arrived(2)
      expectSigned(received[1], ["settings"])

      const seo = await settle(
        http.post(
          "/admin/platform-settings/seo",
          { ai_crawler_preset: "block_training" },
          { headers: admin.headers }
        )
      )
      expect(seo.status).toBe(200)
      await arrived(3)
      expectSigned(received[2], ["settings", "site"])
      // A fresh nonce each time: the storefront refuses one it has seen
      expect(new Set(received.map((call) => call.body.nonce)).size).toBe(3)
    })

    it("keeps the publication when the storefront answers 500 or never answers", async () => {
      expect((await saveDraft()).status).toBe(200)

      answers = [500]
      let refused = 0
      const failedLog = await captureOutput(async () => {
        refused = (await publish()).status
        await arrived(1)
        // The 500 comes back at once; its line follows
        await new Promise((resolve) => setTimeout(resolve, 500))
      })
      expect(refused).toBe(200)
      expect(failedLog).toMatch(/"event":"storefront\.refresh_failed"[^\n]*"status":500/)

      answers = ["hang"]
      let waited = 0
      let stillHeld = 0
      const timeoutLog = await captureOutput(async () => {
        waited = (await publish()).status
        await arrived(2)
        // The publication answered while the storefront still holds the signal
        stillHeld = held.filter((res) => !res.writableEnded).length
        // Past the signal's 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3500))
      })
      expect(waited).toBe(200)
      expect(stillHeld).toBe(1)
      expect(timeoutLog).toMatch(/"event":"storefront\.refresh_failed"[^\n]*"reason":"timeout"/)
      const live = await settle(
        http.get<{ layout: { revision: number } }>("/admin/storefront-layout", {
          headers: admin.headers,
        })
      )
      expect(live.data.layout.revision).toBe(2)
    })
  },
})
