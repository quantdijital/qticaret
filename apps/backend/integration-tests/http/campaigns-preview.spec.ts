import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { smsLength } from "../../src/lib/campaigns/sms"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

const BODY = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Merhaba {ad}, {mağaza_adı} indirimde." }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Alışverişe başla",
          marks: [{ type: "link", attrs: { href: "/indirim" } }],
        },
      ],
    },
  ],
}
const OPT_OUT = "Ret için RET yazıp 4600'e gönderin."

interface Campaign {
  id: string
  channel: string
  status: string
}

/** adr/0050: the list's channel filter, the empty audience refused, the rendered preview. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let groupId: string
    let emptyGroupId: string
    let customer: { name: string; email: string }

    const messaging = () => getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE)
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const post = <T>(path: string, body: unknown, headers = admin.headers) =>
      settle(http.post<T & { message?: string }>(`/admin/bulk-messages${path}`, body, { headers }))
    const get = <T>(path: string, headers = admin.headers) =>
      settle(http.get<T & { message?: string }>(`/admin/bulk-messages${path}`, { headers }))

    const draft = async (audience: unknown[], channel: "email" | "sms" = "email") => {
      const content =
        channel === "email"
          ? { subject: "{ad}, kış indirimi başladı", preheader: "Seçili ürünlerde %20", body: BODY }
          : { sms_text: "Kış indirimi başladı" }
      const { data, status } = await post<{ campaign: Campaign }>("", {
        name: "Kış indirimi",
        channel,
        audience,
        ...content,
      })
      expect(status).toBe(201)
      return data.campaign
    }

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      await container.resolve(Modules.USER).updateUsers({ id: admin.userId, first_name: "Selin" })
      await settings().setFeature("marketing.campaigns", true, null)
      await settings().saveSection("seo", { canonical_host: "magaza.example" }, null)
      await settings().saveSection("legal", { company_title: "Örnek Ticaret Ltd. Şti." }, null)
      await settings().saveSection("marketing", { sms_opt_out_text: OPT_OUT }, null)
      await messaging().createSenderDomains({
        name: "magaza.example",
        resend_id: "sahte",
        status: "verified",
        records: {},
        verified_at: new Date(),
      })
      const run = randomUUID().slice(0, 6)
      const customers = container.resolve(Modules.CUSTOMER)
      const [group, empty] = await customers.createCustomerGroups([
        { name: `Kış ${run}` },
        { name: `Boş ${run}` },
      ])
      groupId = group?.id ?? ""
      emptyGroupId = empty?.id ?? ""
      customer = { name: "Ayşe", email: `ayse-${run}@example.com` }
      const [made] = await customers.createCustomers([
        { first_name: customer.name, email: customer.email },
      ])
      await customers.addCustomerToGroup({
        customer_id: made?.id ?? "",
        customer_group_id: groupId,
      })
      const { id } = await messaging().recordConsent({
        channel: "email",
        address: customer.email,
        status: "granted",
        source: "account",
        customer_id: made?.id ?? null,
        evidence: { text_version: "test" },
      })
      await messaging().updateMessageConsents({ id, iys_status: "sent" })
    })

    it("lists bulk messages by channel", async () => {
      const email = await draft([{ kind: "group", id: groupId }])
      const sms = await draft([{ kind: "all_consented" }], "sms")
      const texts = await get<{ campaigns: Campaign[] }>("?channel=sms&limit=100")
      expect(texts.status).toBe(200)
      expect(texts.data.campaigns.map((each) => each.channel)).not.toContain("email")
      expect(texts.data.campaigns.map((each) => each.id)).toContain(sms.id)
      const mails = await get<{ campaigns: Campaign[] }>("?channel=email&status=draft&limit=100")
      expect(mails.data.campaigns.map((each) => each.id)).toContain(email.id)
      expect(mails.data.campaigns.map((each) => each.id)).not.toContain(sms.id)
      expect((await get("?channel=whatsapp")).status).toBe(400)
    })

    it("refuses to send or schedule to an audience that reaches no one", async () => {
      const nobody = await draft([{ kind: "group", id: emptyGroupId }])
      const sent = await post(`/${nobody.id}/send`, {})
      expect([sent.status, sent.data.message]).toEqual([400, "campaigns.audience_empty"])
      const later = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const scheduled = await post(`/${nobody.id}/schedule`, { scheduled_at: later })
      expect([scheduled.status, scheduled.data.message]).toEqual([400, "campaigns.audience_empty"])
      expect((await get<{ campaign: Campaign }>(`/${nobody.id}`)).data.campaign.status).toBe(
        "draft"
      )

      const one = await draft([{ kind: "group", id: groupId }])
      const accepted = await post<{ campaign: Campaign }>(`/${one.id}/send`, {})
      expect([accepted.status, accepted.data.campaign.status]).toEqual([200, "sending"])
    })

    it("renders the e-mail for the asking staff member, with the footer and a dead way out", async () => {
      const campaign = await draft([{ kind: "group", id: groupId }])
      const preview = await get<{ subject: string; preheader: string; html: string }>(
        `/${campaign.id}/preview?channel=email`
      )
      expect(preview.status).toBe(200)
      expect(preview.headers["cache-control"]).toBe("no-store")
      expect(preview.data.subject).toBe("Selin, kış indirimi başladı")
      expect(preview.data.preheader).toBe("Seçili ürünlerde %20")
      expect(preview.data.html).toContain("Merhaba Selin")
      expect(preview.data.html).toContain("Örnek Ticaret Ltd. Şti.")
      expect(preview.data.html).toContain("Bu iletileri almak istemiyorum")
      expect(preview.data.html).toContain("utm_campaign=")
      // Never a real recipient: not the audience's customer, not an address
      const shown = JSON.stringify(preview.data)
      expect(shown).not.toContain(customer.name)
      expect(shown).not.toContain(customer.email)
      expect(shown).not.toContain(admin.email)
      expect(preview.data.subject).not.toMatch(/^\[Deneme\]/)

      const token = /\/abonelik\/cik\?t=([^"&]+)/.exec(preview.data.html)?.[1] ?? ""
      expect(token).not.toBe("")
      const leave = await settle(
        http.post<string>(`/unsubscribe?t=${token}`, "List-Unsubscribe=One-Click", {
          headers: { "content-type": "application/x-www-form-urlencoded" },
        })
      )
      expect(leave.status).toBe(400)
      expect(await messaging().consentOf("email", customer.email)).toBe("granted")
      expect(fake.messages).toHaveLength(0)
    })

    it("renders a text with the backend's part count, readable by the operations role", async () => {
      const campaign = await draft([{ kind: "all_consented" }], "sms")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const preview = await get<{ text: string; parts: number }>(
        `/${campaign.id}/preview?channel=sms`,
        operations.headers
      )
      expect(preview.status).toBe(200)
      expect(preview.data.text.startsWith("Kış indirimi başladı. ")).toBe(true)
      expect(preview.data.text.endsWith(OPT_OUT)).toBe(true)
      expect(preview.data.parts).toBe(smsLength(preview.data.text).parts)
      const counted = await post<{ sms: { parts: number } }>(`/${campaign.id}/audience-preview`, {})
      expect(preview.data.parts).toBe(counted.data.sms.parts)
      expect((await get(`/${campaign.id}/preview?channel=fax`)).status).toBe(400)
      expect((await get(`/${campaign.id}/preview?to=x@example.com`)).status).toBe(400)
    })
  },
})
