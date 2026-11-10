import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { MESSAGE_TEMPLATES } from "../../src/lib/messaging/templates"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { deliver } from "../../src/workflows/messaging/deliver"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface View {
  name: string
  group: string
  switch: string
  enabled: boolean
  tokens: { name: string; sample: string }[]
  fields: { field: string; default: string; text: string | null }[]
}

interface Preview {
  email: { subject: string; html: string; text: string } | null
  sms: string | null
  message?: string
  values?: Record<string, string>
}

/** adr/0036 Ek 2026-11-10: the shop's words for its customer messages, and their switch. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let fake: FakeMail
    const LIST = "/admin/messaging/customer-messages"
    const MAIL_ENV = ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]
    const saved: Record<string, string | undefined> = {}

    const get = <T>(path: string, headers = owner.headers) =>
      settle(http.get<T & { message?: string }>(path, { headers }))
    const post = <T>(path: string, body: unknown, headers = owner.headers) =>
      settle(http.post<T & { message?: string }>(path, body, { headers }))
    const save = (name: string, body: unknown, headers = owner.headers) =>
      post<{ customer_message: View }>(`${LIST}/${name}`, body, headers)

    beforeAll(async () => {
      fake = await startFakeMail()
      for (const name of MAIL_ENV) {
        saved[name] = process.env[name]
      }
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of MAIL_ENV) {
        if (saved[name] === undefined) {
          Reflect.deleteProperty(process.env, name)
        } else {
          process.env[name] = saved[name]
        }
      }
      await fake.close()
    })

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
    })

    it("lists the customer messages by group, each with its fields, tokens and switch", async () => {
      const list = await get<{ messages: View[] }>(LIST)

      expect(list.status).toBe(200)
      expect(list.headers["cache-control"]).toBe("no-store")
      const names = list.data.messages.map((each) => each.name)
      expect(names.some((name) => name.startsWith("staff."))).toBe(false)
      expect(names).not.toContain("marketing.campaign")
      const placed = list.data.messages.find((each) => each.name === "order.placed")
      expect(placed).toMatchObject({ group: "order", switch: "required", enabled: true })
      expect(placed?.fields.map((each) => each.field)).toEqual([
        "subject",
        "preheader",
        "heading",
        "intro",
        "sms",
      ])
      expect(placed?.fields[0]).toEqual({
        field: "subject",
        default: "Siparişiniz alındı (#{sipariş_no})",
        text: null,
      })
      expect(placed?.tokens).toContainEqual({ name: "sipariş_no", sample: "1042" })
      expect(list.data.messages.find((each) => each.name === "cart.reminder")).toMatchObject({
        group: "marketing",
        switch: "marketing",
        enabled: false,
      })
      expect(list.data.messages.find((each) => each.name === "order.shipped")?.switch).toBe("here")
    })

    it("saves the shop's words, previews them, sends them and records who changed what", async () => {
      const response = await save("order.delivered", {
        subject: "Paketiniz teslim edildi, {müşteri_adı}",
        intro: "Merhaba {müşteri_adı},\n#{sipariş_no} elinizde. <b>Teşekkürler</b>",
        heading: "{müşteri_adı}, siparişiniz teslim edildi",
      })

      expect(response.status).toBe(200)
      const fields = response.data.customer_message.fields
      expect(fields.find((each) => each.field === "subject")?.text).toBe(
        "Paketiniz teslim edildi, {müşteri_adı}"
      )
      // Sent back as the default: nothing kept
      expect(fields.find((each) => each.field === "heading")?.text).toBeNull()

      const preview = await get<Preview>("/admin/messaging/templates/order.delivered/preview")
      expect(preview.headers["cache-control"]).toBe("no-store")
      expect(preview.data.email?.subject).toBe("Paketiniz teslim edildi, Ayşe")
      expect(preview.data.email?.html).toContain(
        "Merhaba Ayşe,<br>#1042 elinizde. &lt;b&gt;Teşekkürler&lt;/b&gt;"
      )

      const outcomes = await deliver(getContainer(), {
        template: "order.delivered",
        resource: { type: "order", id: "order_texts_1" },
        recipients: { email: "ayse@example.com" },
        receiverId: null,
        vars: { ...MESSAGE_TEMPLATES["order.delivered"].sample, customerName: "<i>Ayşe</i>" },
      })
      expect(outcomes).toEqual({ email: "sent" })
      const mail = fake.messages.find((each) => each.to.includes("ayse@example.com"))
      expect(mail?.subject).toBe("Paketiniz teslim edildi, <i>Ayşe</i>")
      expect(mail?.html).toContain("Merhaba &lt;i&gt;Ayşe&lt;/i&gt;,<br>#1042 elinizde.")
      // The heading falls back to the platform's
      expect(mail?.html).toContain("&lt;i&gt;Ayşe&lt;/i&gt;, siparişiniz teslim edildi")

      const log = getContainer().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const [entry] = await eventually(
        () =>
          log.listAuditEntries({
            resource_type: "message_template",
            resource_id: "order.delivered",
          }),
        (found) => found.length > 0
      )
      expect(entry).toMatchObject({
        action: "POST /admin/messaging/customer-messages/:name",
        outcome: 200,
      })
      const changes = entry?.changes as { fields?: string[]; diff?: unknown }
      expect(changes.fields).toEqual(["subject", "intro", "heading"])
      expect(JSON.stringify(changes.diff)).toContain("subject")
    })

    it("does not send an optional message the shop turned off", async () => {
      expect((await save("order.shipped", { enabled: false })).status).toBe(200)

      const outcomes = await deliver(getContainer(), {
        template: "order.shipped",
        resource: { type: "fulfillment", id: "ful_texts_off" },
        recipients: { email: "kapali@example.com" },
        receiverId: null,
        vars: MESSAGE_TEMPLATES["order.shipped"].sample,
      })

      expect(outcomes).toEqual({ email: "template_off" })
      expect(fake.messages.some((each) => each.to.includes("kapali@example.com"))).toBe(false)
      const list = await get<{ messages: View[] }>(LIST)
      expect(list.data.messages.find((each) => each.name === "order.shipped")?.enabled).toBe(false)
      await save("order.shipped", { enabled: true })
    })

    it("refuses an unknown token by name, and turning a required message off", async () => {
      const unknown = await save("order.placed", { subject: "Sipariş {siparis_no} {iban}" })
      const required = await save("order.placed", { enabled: false })
      const draft = await post<Preview>("/admin/messaging/templates/order.placed/preview", {
        sms: "{mağaza_adı} {kupon}",
      })

      // A bearer client gets the key and what its sentence names (adr/0021)
      expect(unknown.status).toBe(400)
      expect(unknown.data).toMatchObject({
        message: "messaging.template_token_unknown",
        values: { tokens: "{siparis_no}, {iban}" },
      })
      expect([required.status, required.data.message]).toEqual([400, "messaging.template_required"])
      expect(draft.status).toBe(400)
      expect(draft.data).toMatchObject({ values: { tokens: "{kupon}" } })
      const list = await get<{ messages: View[] }>(LIST)
      const placed = list.data.messages.find((each) => each.name === "order.placed")
      expect(placed?.fields.every((each) => each.text === null)).toBe(true)
    })

    it("previews a draft without keeping it", async () => {
      const draft = await post<Preview>("/admin/messaging/templates/order.placed/preview", {
        sms: "{mağaza_adı}: #{sipariş_no} hazırlanıyor, {toplam}",
      })
      const stored = await get<Preview>("/admin/messaging/templates/order.placed/preview")

      expect(draft.status).toBe(200)
      expect(draft.headers["cache-control"]).toBe("no-store")
      expect(draft.data.sms).toMatch(/: #1042 hazırlanıyor, ₺389,80$/)
      expect(stored.data.sms).toContain("numaralı siparişiniz alındı")
    })

    it("lets the owner and an admin change the words; operations and read-only staff only read", async () => {
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const body = { subject: "Faturanız: {fatura_no}" }

      expect((await save("order.invoiced", body, admin.headers)).status).toBe(200)
      expect((await save("order.invoiced", body, operations.headers)).status).toBe(403)
      expect((await save("order.invoiced", body, readonly.headers)).status).toBe(403)
      expect((await get<unknown>(LIST, operations.headers)).status).toBe(200)
      expect((await save("order.invoiced", body, {})).status).toBe(401)
      expect((await save("staff.new_order", body)).status).toBe(404)
      expect((await save("order.invoiced", { subject: 5 })).status).toBe(400)
      await save("order.invoiced", { subject: null })
    })
  },
})
