import { createHmac } from "node:crypto"
import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { deliverWebhooks, queueStockChanges } from "../../src/jobs/tenant-webhooks"
import { isBlockedAddress } from "../../src/lib/security/safe-fetch"
import { createSafeFetch } from "../../src/lib/security/safe-fetch/safe-fetch"
import { webhookTransport } from "../../src/lib/webhooks"
import { TENANT_WEBHOOKS_MODULE } from "../../src/modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../../src/modules/tenant-webhooks/service"
import { MAX_STREAK, MAX_SUBSCRIPTIONS } from "../../src/modules/tenant-webhooks/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

// The minute's job (jobs/tenant-webhooks.ts) runs in this process too and holds no lock a
// case could take: between a case's own calls it queued the stock changes and delivered
// what was due (PR #88; PR #112's CI: `first` also took the two stock changes it had just
// queued, `delivered: 2`). Medusa loads jobs with require(), so it registers this one: the
// schedule kept, the run doing nothing. Each case runs the job's halves itself
jest.mock("../../src/jobs/tenant-webhooks", () => ({
  ...jest.requireActual<Record<string, unknown>>("../../src/jobs/tenant-webhooks"),
  __esModule: true,
  default: () => Promise.resolve(),
}))

interface Received {
  headers: Record<string, string | string[] | undefined>
  body: string
}

const minutesLater = (minutes: number) => new Date(Date.now() + minutes * 60_000)
const realSend = webhookTransport.send

/** F11.7 (adr/0039 §7; KK3): signed events to the shop's systems, retried, never inside. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string>; plain: Record<string, string> }
    let shop: StockShop
    let receiver: Server
    let receiverUrl: string
    const received: Received[] = []
    let answers: number[] = []

    const hooks = () => getContainer().resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
    const subscribe = (body: Record<string, unknown>) =>
      settle(
        http.post<{ subscription: { id: string }; secret: string; message?: string }>(
          "/admin/webhooks",
          body,
          { headers: admin.headers }
        )
      )

    beforeAll(async () => {
      receiver = createServer((req, res) => {
        const chunks: Buffer[] = []
        req.on("data", (chunk: Buffer) => chunks.push(chunk))
        req.on("end", () => {
          received.push({ headers: req.headers, body: Buffer.concat(chunks).toString("utf8") })
          res.writeHead(answers.shift() ?? 200).end("ok")
        })
      })
      await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve))
      receiverUrl = `http://127.0.0.1:${String((receiver.address() as AddressInfo).port)}/hook`
    })

    afterAll(async () => {
      webhookTransport.send = realSend
      await new Promise((resolve) => receiver.close(resolve))
    })

    beforeEach(async () => {
      received.length = 0
      answers = []
      // The shop's system is this test's server, whatever address was subscribed
      webhookTransport.send = async (_url, options) => {
        const answer = await fetch(receiverUrl, {
          method: options.method ?? "POST",
          headers: options.headers ?? {},
          // The sender sends text: a JSON body
          body: typeof options.body === "string" ? options.body : null,
        })
        return {
          status: answer.status,
          headers: {},
          body: Buffer.from(await answer.arrayBuffer()),
          url: receiverUrl,
        }
      }
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
    })

    it("signs each event, nothing personal in it, and tries a refused one later (KK3)", async () => {
      const made = await subscribe({
        url: "https://hooks.example.com/qt",
        events: ["order.placed", "stock.changed"],
      })
      const { variantId } = await stockedProduct(getContainer(), shop, "webhook-kupa", 5, 120)
      await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        email: "ayse.yilmaz@example.com",
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
      await eventually(
        () => hooks().listWebhookDeliveries({ event: "order.placed" }),
        (rows) => rows.length === 1
      )
      answers = [500]

      const first = await deliverWebhooks(getContainer())
      const tooSoon = await deliverWebhooks(getContainer())
      const later = await deliverWebhooks(getContainer(), minutesLater(2))
      const stock = await queueStockChanges(getContainer())
      await deliverWebhooks(getContainer(), minutesLater(3))

      // The order's own deliveries; the stock changes come after them
      const [refused, sent] = received.filter((each) => each.body.includes('"type":"order.placed"'))
      const signature = String(sent?.headers["x-webhook-signature"] ?? "")
      const [, t = "", v1 = ""] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(signature) ?? []
      const expected = createHmac("sha256", made.data.secret)
        .update(`${t}.${sent?.body ?? ""}`)
        .digest("hex")

      expect(made.status).toBe(201)
      expect(made.data.secret).toMatch(/^whsec_/)
      expect(first).toMatchObject({ delivered: 0, failed: 1 })
      expect(tooSoon).toMatchObject({ delivered: 0, failed: 0 })
      expect(later).toMatchObject({ delivered: 1, failed: 0 })
      // The same delivery both times: the receiver can tell it saw it already
      expect(refused?.headers["x-webhook-id"]).toBe(sent?.headers["x-webhook-id"])
      expect(v1).toBe(expected)
      expect(JSON.parse(sent?.body ?? "{}")).toMatchObject({
        type: "order.placed",
        data: {
          display_id: expect.any(Number) as unknown,
          total: expect.any(String) as unknown,
          units: 1,
        },
      })
      expect(sent?.body).not.toMatch(/ayse|Yılmaz|Demo Sokak|example\.com/i)
      expect(stock).toBeGreaterThan(0)
      expect(received.some((each) => each.body.includes('"type":"stock.changed"'))).toBe(true)
    })

    it("signs with a new secret once rotated, the person asked again (the F15 audit)", async () => {
      const made = await subscribe({
        url: "https://hooks.example.com/qt",
        events: ["order.placed"],
      })
      const rotate = (headers: Record<string, string>) =>
        settle(
          http.post<{ secret: string }>(
            `/admin/webhooks/${made.data.subscription.id}/rotate-secret`,
            {},
            { headers }
          )
        )
      const unproved = await rotate(admin.plain)
      const rotated = await rotate(admin.headers)
      await hooks().enqueue("order.placed", "rotate-1", { display_id: 1 })
      await deliverWebhooks(getContainer())

      const [sent] = received
      const [, t = "", v1 = ""] =
        /^t=(\d+),v1=([0-9a-f]{64})$/.exec(String(sent?.headers["x-webhook-signature"] ?? "")) ?? []
      const signed = (secret: string) =>
        createHmac("sha256", secret)
          .update(`${t}.${sent?.body ?? ""}`)
          .digest("hex")

      expect(unproved.status).toBe(428)
      expect(rotated.status).toBe(200)
      expect(rotated.data.secret).toMatch(/^whsec_/)
      expect(rotated.data.secret).not.toBe(made.data.secret)
      expect(v1).toBe(signed(rotated.data.secret))
      expect(v1).not.toBe(signed(made.data.secret))
    })

    it("refuses an address inside, when subscribed and when a name resolves inside (KK3)", async () => {
      const literal = await subscribe({ url: "https://127.0.0.1/hook", events: ["order.placed"] })
      const metadata = await subscribe({
        url: "https://169.254.169.254/x",
        events: ["order.placed"],
      })
      const local = await subscribe({ url: "https://localhost/hook", events: ["order.placed"] })
      const plain = await subscribe({
        url: "http://hooks.example.com/qt",
        events: ["order.placed"],
      })
      const sneaky = await subscribe({
        url: "https://hooks.example.com/qt",
        events: ["order.placed"],
      })
      // The name resolves to a loopback address: safe-fetch refuses to connect
      webhookTransport.send = createSafeFetch({
        resolve: () => Promise.resolve([{ address: "127.0.0.1", family: 4 }]),
        isAddressAllowed: (address) => !isBlockedAddress(address),
      })
      await hooks().enqueue("order.placed", "order.placed:inside", { order_id: "o1" })

      const outcome = await deliverWebhooks(getContainer())
      const [delivery] = await hooks().listWebhookDeliveries({
        subscription_id: sneaky.data.subscription.id,
      })

      expect([literal, metadata, local].map((each) => each.data.message)).toEqual([
        "webhook.url_internal",
        "webhook.url_internal",
        "webhook.url_internal",
      ])
      expect(plain.data.message).toBe("webhook.url_https")
      expect(outcome).toMatchObject({ delivered: 0, failed: 1 })
      expect(delivery).toMatchObject({ status: "pending", last_error: "address_not_allowed" })
      expect(received).toEqual([])
    })

    it("turns a subscription off after failures in a row, rings the bell, and on again", async () => {
      const made = await subscribe({
        url: "https://hooks.example.com/qt",
        events: ["order.canceled"],
      })
      answers = Array.from({ length: MAX_STREAK }, () => 503)
      await hooks().enqueue("order.canceled", "order.canceled:o1", { order_id: "o1" })
      // One delivery refused again and again, a day apart: its failures in a row
      for (let n = 0; n < MAX_STREAK; n++) {
        await deliverWebhooks(getContainer(), minutesLater(24 * 60 * (n + 1)))
      }
      const page = await http.get<{
        subscription: { status: string }
        deliveries: { last_status: number }[]
      }>(`/admin/webhooks/${made.data.subscription.id}`, { headers: admin.headers })
      const bell = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed" }, { select: ["data"] })
      const on = await settle(
        http.post<{ subscription: { status: string; failure_streak: number } }>(
          `/admin/webhooks/${made.data.subscription.id}`,
          { status: "active" },
          { headers: admin.headers }
        )
      )

      expect(page.data.subscription.status).toBe("disabled")
      expect(page.data.deliveries[0]?.last_status).toBe(503)
      expect(bell.filter(({ data }) => data?.["kind"] === "webhook_disabled")).toHaveLength(1)
      expect(on.data.subscription).toMatchObject({ status: "active", failure_streak: 0 })
    })

    it("lets a key manage its own subscriptions, to the events its scopes read", async () => {
      const key = (scopes: string[]) =>
        settle(
          http.post<{ token: string }>(
            "/admin/api-access",
            { title: "Entegrasyon", scopes },
            { headers: admin.headers }
          )
        )
      const basic = (token: string) => ({
        authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
      })
      const manager = (await key(["webhooks:manage", "catalog:read"])).data.token
      const reader = (await key(["orders:read"])).data.token
      const staffs = await subscribe({
        url: "https://muhasebe.example.com/qt",
        events: ["order.placed"],
      })

      const made = await settle(
        http.post<{ subscription: { id: string } }>(
          "/admin/webhooks",
          { url: "https://erp.example.com/qt", events: ["stock.changed"] },
          { headers: basic(manager) }
        )
      )
      const orders = await settle(
        http.post<{ message: string }>(
          "/admin/webhooks",
          { url: "https://erp.example.com/qt", events: ["order.placed"] },
          { headers: basic(manager) }
        )
      )
      const listed = await settle(
        http.get<{ subscriptions: { id: string }[] }>("/admin/webhooks", {
          headers: basic(manager),
        })
      )
      const others = await settle(
        http.get(`/admin/webhooks/${staffs.data.subscription.id}`, { headers: basic(manager) })
      )
      const repoint = await settle(
        http.post(
          `/admin/webhooks/${staffs.data.subscription.id}`,
          { url: "https://kotu.example.com/x" },
          { headers: basic(manager) }
        )
      )
      const refused = await settle(http.get("/admin/webhooks", { headers: basic(reader) }))
      const staffList = await http.get<{ subscriptions: { id: string }[] }>("/admin/webhooks", {
        headers: admin.headers,
      })

      expect(made.status).toBe(201)
      expect(orders.status).toBe(403)
      expect(orders.data.message).toBe("webhook.event_scope")
      expect(listed.data.subscriptions.map((row) => row.id)).toEqual([made.data.subscription.id])
      expect([others.status, repoint.status]).toEqual([404, 404])
      expect(refused.status).toBe(403)
      expect(staffList.data.subscriptions).toHaveLength(2)
    })

    it("keeps a shop to its share of subscriptions", async () => {
      const hooksService = hooks()
      for (let n = 0; n < MAX_SUBSCRIPTIONS; n++) {
        await hooksService.subscribe({
          url: `https://hooks${String(n)}.example.com/qt`,
          events: ["order.placed"],
          created_by: null,
        })
      }

      const over = await subscribe({
        url: "https://one-more.example.com/qt",
        events: ["order.placed"],
      })

      expect(over.status).toBe(400)
      expect(over.data.message).toBe("webhook.limit")
    })
  },
})
