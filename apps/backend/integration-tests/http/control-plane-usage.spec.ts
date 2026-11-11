import { createServer } from "node:http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MemoryNonceStore, verifySignedRequest } from "@qticaret/server-kit"
import { usageReportSchema } from "@qticaret/types/control-plane"
import { TENANT_ID } from "@qticaret/types/control-plane/testing"
import { USAGE_PATH, sendUsageReport } from "../../src/lib/control-plane/report"
import { startOfTurkishMonth, turkishMonth } from "../../src/lib/control-plane/usage"
import { CONTENT_DRAFTS_MODULE } from "../../src/modules/content-drafts"
import type ContentDraftsModuleService from "../../src/modules/content-drafts/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import { MANAGED_ENV, listen, managedForThisFile, shop } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"

jest.setTimeout(240 * 1000)

const MB = 1024 * 1024
const release = { version: "1.2.3", commit: "0123abc" }
// Personal data the shop holds: none of it may leave in a report
const SHOPPER = {
  email: "ayse.yilmaz@example.com",
  first_name: "Ayşe",
  last_name: "Yılmaz",
  address_1: "Bağdat Caddesi 12",
  phone: "+905321234567",
}

interface Received {
  status: string
  body: string
}

/** A stand-in control plane: checks the signature over the exact body, keeps what came. */
function fakeUsageEndpoint() {
  const nonces = new MemoryNonceStore()
  const received: Received[] = []
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8")
      void verifySignedRequest(
        { method: req.method ?? "", path: req.url ?? "", headers: req.headers, body },
        {
          publicKey: (kid, tenantId) =>
            kid === shop.kid && tenantId === TENANT_ID ? shop.privateKey : undefined,
          nonces,
        }
      ).then((verified) => {
        received.push({ status: verified.ok ? "signed" : verified.code, body })
        res.writeHead(verified.ok ? 200 : 401, { "content-type": "application/json" })
        res.end(JSON.stringify({ ok: verified.ok }))
      })
    })
  })
  return { server, received }
}

/**
 * adr/0061 §5.4, Ek C13: the shop's hourly usage report holds exactly the
 * contract's totals, signed over its bytes: products, this Turkish month's
 * orders (drafts out), staff, stored megabytes, drafts asked for, the last
 * order's time and the release. No person, address, e-mail or line.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const container = (): MedusaContainer => getContainer()

    managedForThisFile()

    it("sends the shop's totals and nothing else", async () => {
      // Mid-month of today's month: the drafts' (UTC) and Turkey's months agree
      const now = new Date()
      now.setUTCDate(15)
      await createAdminUser(http, container())
      await container()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Şef bıçağı" }, { title: "Çakı", status: "draft" }])
      const orders = container().resolve(Modules.ORDER)
      const address = { ...SHOPPER, city: "İstanbul", country_code: "tr" }
      await orders.createOrders([
        { currency_code: "try", email: SHOPPER.email, shipping_address: address },
        { currency_code: "try", email: SHOPPER.email, billing_address: address },
        { currency_code: "try", email: SHOPPER.email, status: "draft" },
      ])
      await container()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .createMediaAssets([
          {
            url: "http://localhost/static/a.jpg",
            file_id: "a.jpg",
            size: 2 * MB,
            in_library: true,
          },
          { url: "http://localhost/static/b.jpg", file_id: "b.jpg", size: 1, in_library: true },
          { url: "https://cdn.example.com/c.jpg", size: 50 * MB },
        ])
      await container()
        .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
        .claimQuota(10, now)

      const { server, received } = fakeUsageEndpoint()
      process.env["CONTROL_PLANE_URL"] = await listen(server)
      try {
        expect(await sendUsageReport(container(), { now, release })).toEqual({ outcome: "sent" })
      } finally {
        process.env["CONTROL_PLANE_URL"] = MANAGED_ENV.CONTROL_PLANE_URL
        server.close()
      }

      expect(received.map((each) => each.status)).toEqual(["signed"])
      const body = received[0]?.body ?? ""
      const report = usageReportSchema.parse(JSON.parse(body))
      expect(Object.keys(JSON.parse(body) as object).sort()).toEqual(
        [
          "counts",
          "last_order_at",
          "period",
          "release",
          "reported_at",
          "tenant_id",
          "version",
        ].sort()
      )
      expect(report).toMatchObject({
        version: 1,
        tenant_id: TENANT_ID,
        reported_at: now.toISOString(),
        period: turkishMonth(now),
        counts: {
          products: 2,
          orders_this_month: 2,
          staff: 1,
          // 2 MB and a byte: three started megabytes; the URL-only image holds no file
          storage_mb: 3,
          llm_credits_this_month: 1,
        },
        release,
      })
      expect(new Date(report.last_order_at ?? 0).getTime()).toBeGreaterThanOrEqual(
        startOfTurkishMonth(now).getTime()
      )
      for (const value of Object.values(SHOPPER)) {
        expect(body).not.toContain(value)
      }
      expect(body).not.toMatch(/@|order_0|total|amount|revenue|address|email/i)
    })

    it("sends nothing while unmanaged", async () => {
      const keys = process.env["CONTROL_PLANE_PUBLIC_KEYS"]
      Reflect.deleteProperty(process.env, "CONTROL_PLANE_PUBLIC_KEYS")
      try {
        expect(await sendUsageReport(container(), { release })).toEqual({ outcome: "unmanaged" })
      } finally {
        process.env["CONTROL_PLANE_PUBLIC_KEYS"] = keys
      }
    })

    it("posts to the path the control plane serves", () => {
      expect(USAGE_PATH).toBe("/tenant-api/v1/usage")
    })
  },
})
