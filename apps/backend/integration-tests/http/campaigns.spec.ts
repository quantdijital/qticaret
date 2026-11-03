import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { sharedRateLimitStore } from "../../src/api/http/rate-limit"
import campaignDispatch from "../../src/jobs/campaign-dispatch"
import { CAMPAIGNS_MODULE } from "../../src/modules/campaigns"
import type CampaignsModuleService from "../../src/modules/campaigns/service"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import {
  campaignMessagesFor,
  eraseCampaignRecipients,
} from "../../src/workflows/campaigns/customer-data"
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

interface Campaign {
  id: string
  status: string
  counts: Record<string, unknown>
}

/** adr/0050: bulk e-mail to consented customers and subscribers, through deliver(). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let groupId: string
    let people: Record<"ayse" | "burak" | "cem" | "deniz" | "abone", string>
    const backend = process.env["BACKEND_URL"]

    const messaging = () => getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE)
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const mailsTo = (email: string) => fake.messages.filter(({ to }) => to.includes(email))
    const post = <T>(path: string, body: unknown, headers = admin.headers) =>
      settle(http.post<T & { message?: string }>(`/admin/bulk-messages${path}`, body, { headers }))
    const get = <T>(path: string, headers = admin.headers) =>
      settle(http.get<T & { message?: string }>(`/admin/bulk-messages${path}`, { headers }))

    /** A consent as a confirmed one is kept; told to İYS unless `iys` says otherwise. */
    const consent = async (address: string, customerId: string | null, iys = "sent") => {
      const { id } = await messaging().recordConsent({
        channel: "email",
        address,
        status: "granted",
        source: customerId ? "account" : "newsletter",
        customer_id: customerId,
        evidence: { text_version: "test" },
      })
      await messaging().updateMessageConsents({ id, iys_status: iys as "sent" })
    }

    const draft = async (audience: unknown[] = [{ kind: "group", id: groupId }]) => {
      const { data, status } = await post<{ campaign: Campaign }>("", {
        name: "Kış indirimi",
        channel: "email",
        audience,
        subject: "{ad}, kış indirimi başladı",
        preheader: "Seçili ürünlerde %20",
        body: BODY,
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
        BACKEND_URL: "https://api.magaza.example",
      })
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      if (backend === undefined) {
        Reflect.deleteProperty(process.env, "BACKEND_URL")
      } else {
        process.env["BACKEND_URL"] = backend
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      await settings().setFeature("marketing.campaigns", true, null)
      await settings().saveSection("seo", { canonical_host: "magaza.example" }, null)
      await settings().saveSection("notifications", { email_daily_limit: 200_000 }, null)
      await messaging().createSenderDomains({
        name: "magaza.example",
        resend_id: "sahte",
        status: "verified",
        records: {},
        verified_at: new Date(),
      })
      const run = randomUUID().slice(0, 6)
      const address = (name: string) => `${name}-${run}@example.com`
      const customers = container.resolve(Modules.CUSTOMER)
      const [group] = await customers.createCustomerGroups([{ name: `Kış ${run}` }])
      groupId = group?.id ?? ""
      const made = await customers.createCustomers(
        ["Ayşe", "Burak", "Cem", "Deniz"].map((first_name) => ({
          first_name,
          email: address(first_name.toLowerCase().replace("ş", "s")),
        }))
      )
      for (const customer of made) {
        await customers.addCustomerToGroup({ customer_id: customer.id, customer_group_id: groupId })
      }
      const [ayse, burak, cem, deniz] = made.map((customer) => customer.email)
      people = {
        ayse: ayse ?? "",
        burak: burak ?? "",
        cem: cem ?? "",
        deniz: deniz ?? "",
        abone: address("abone"),
      }
      await consent(people.ayse, made[0]?.id ?? null)
      // Not told to İYS yet: no bulk message may go to it
      await consent(people.burak, made[1]?.id ?? null, "pending")
      await consent(people.deniz, made[3]?.id ?? null)
      await messaging().suppress({
        channel: "email",
        address: people.deniz,
        reason: "manual",
        source: "panel",
      })
      // A newsletter subscriber: a consent with no customer record
      await consent(people.abone, null)
      fake.messages.length = 0
    })

    it("answers as a missing route while the shop has the flag off", async () => {
      await settings().setFeature("marketing.campaigns", false, null)
      expect((await get("")).status).toBe(404)
    })

    it("keeps a draft, refuses an unknown token, and counts the audience without naming anyone", async () => {
      const campaign = await draft()
      expect(campaign).toMatchObject({ status: "draft", counts: { sent: 0 } })
      const misspelt = await post(`/${campaign.id}`, { subject: "{isim}, fırsat" })
      expect([misspelt.status, misspelt.data.message]).toEqual([400, "campaigns.token_unknown"])

      const preview = await post<{ audience: number; eligible: number; excluded: object }>(
        `/${campaign.id}/audience-preview`,
        {}
      )
      expect(preview.data).toMatchObject({
        audience: 4,
        eligible: 1,
        excluded: { no_consent: 1, iys_pending: 1, suppressed: 1, recent: 0 },
      })
      const withSubscribers = await post<{ eligible: number }>(`/${campaign.id}/audience-preview`, {
        audience: [{ kind: "group", id: groupId }, { kind: "newsletter" }],
      })
      expect(withSubscribers.data.eligible).toBe(2)
      expect(JSON.stringify([preview.data, withSubscribers.data])).not.toContain("@")
    })

    it("sends a test to the asking staff member's own address only", async () => {
      const campaign = await draft()
      const elsewhere = await post(`/${campaign.id}/test-send`, { to: people.cem })
      expect(elsewhere.status).toBe(400)
      const test = await post<{ sent: boolean }>(`/${campaign.id}/test-send`, {})
      expect(test.status).toBe(200)
      expect(fake.messages).toHaveLength(1)
      expect(fake.messages[0]?.to).toEqual([admin.email])
      expect(fake.messages[0]?.subject).toMatch(/^\[Deneme\] /)
      expect(mailsTo(people.ayse)).toHaveLength(0)
    })

    it("sends after re-authentication, to consented recipients once, with the way out", async () => {
      const campaign = await draft([{ kind: "group", id: groupId }, { kind: "newsletter" }])
      const bare = await post(`/${campaign.id}/send`, {}, admin.plain)
      expect([bare.status, bare.data.message]).toEqual([428, "staff.reauth_required"])
      const sent = await post<{ campaign: Campaign }>(`/${campaign.id}/send`, {})
      expect(sent.data.campaign.status).toBe("sending")

      await campaignDispatch(getContainer())
      expect(fake.messages.map(({ to }) => to[0]).sort()).toEqual(
        [people.ayse, people.abone].sort()
      )
      const [toAyse] = mailsTo(people.ayse)
      expect(toAyse?.subject).toBe("Ayşe, kış indirimi başladı")
      expect(toAyse?.html).toContain("Merhaba Ayşe")
      expect(toAyse?.html).toContain("utm_campaign=")
      expect(toAyse?.headers["List-Unsubscribe"]).toContain(
        "https://api.magaza.example/unsubscribe"
      )
      expect(toAyse?.html).toContain("Bu iletileri almak istemiyorum")
      // A subscriber has no name on record: the greeting every shopper gets
      expect(mailsTo(people.abone)[0]?.html).toContain("Merhaba Değerli müşterimiz")

      await campaignDispatch(getContainer())
      expect(fake.messages).toHaveLength(2)
      const report = await get<{ report: { status: string; counts: Record<string, unknown> } }>(
        `/${campaign.id}/report`
      )
      expect(report.data.report).toMatchObject({
        status: "sent",
        counts: {
          audience: 5,
          targeted: 2,
          sent: 2,
          skipped: { no_consent: 1, iys_pending: 1, suppressed: 1 },
        },
      })
      const rows = await getContainer()
        .resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
        .listBulkMessageRecipients({ campaign_id: campaign.id })
      expect(rows).toHaveLength(2)
      expect(
        JSON.stringify([report.data, rows, (await get(`/${campaign.id}`)).data])
      ).not.toContain("@")

      // Within 24 hours the same people get no other bulk message
      const copy = await post<{ campaign: Campaign }>(`/${campaign.id}/copy`, {})
      const again = await post<{ eligible: number; excluded: { recent: number } }>(
        `/${copy.data.campaign.id}/audience-preview`,
        {}
      )
      expect(again.data).toMatchObject({ eligible: 0, excluded: { recent: 2 } })
    })

    it("locks a scheduled campaign's content and starts it when its time comes", async () => {
      const campaign = await draft()
      const past = await post(`/${campaign.id}/schedule`, { scheduled_at: "2020-01-01T09:00:00Z" })
      expect([past.status, past.data.message]).toEqual([400, "campaigns.schedule_invalid"])
      const later = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const bare = await post(`/${campaign.id}/schedule`, { scheduled_at: later }, admin.plain)
      expect(bare.status).toBe(428)
      const scheduled = await post<{ campaign: Campaign }>(`/${campaign.id}/schedule`, {
        scheduled_at: later,
      })
      expect(scheduled.data.campaign.status).toBe("scheduled")
      const edit = await post(`/${campaign.id}`, { name: "Başka" })
      expect([edit.status, edit.data.message]).toEqual([409, "campaigns.locked"])

      await campaignDispatch(getContainer())
      expect(fake.messages).toHaveLength(0)
      await getContainer()
        .resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
        .updateBulkMessages({ id: campaign.id, scheduled_at: new Date(Date.now() - 1000) })
      await campaignDispatch(getContainer())
      expect(fake.messages.map(({ to }) => to[0])).toEqual([people.ayse])
    })

    it("lets the operations role read bulk messages but write none", async () => {
      const campaign = await draft()
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await get("", operations.headers)).status).toBe(200)
      expect(
        (await post("", { name: "x", channel: "email", audience: [] }, operations.headers)).status
      ).toBe(403)
      expect((await post(`/${campaign.id}/send`, {}, operations.headers)).status).toBe(403)
    })

    it("refuses a text campaign without the shop's SMS account", async () => {
      const { data } = await post<{ campaign: Campaign }>("", {
        name: "SMS",
        channel: "sms",
        audience: [{ kind: "all_consented" }],
        sms_text: "Kış indirimi başladı",
      })
      const sent = await post(`/${data.campaign.id}/send`, {})
      expect([sent.status, sent.data.message]).toEqual([400, "campaigns.sms_account_missing"])
    })

    it("lets staff pause, resume and cancel a sending campaign", async () => {
      const campaign = await draft()
      await post(`/${campaign.id}/send`, {})
      const paused = await post<{ campaign: Campaign & { paused_reason: string } }>(
        `/${campaign.id}/pause`,
        {}
      )
      expect(paused.data.campaign).toMatchObject({ status: "paused", paused_reason: "staff" })
      // A pause staff made waits for staff
      await campaignDispatch(getContainer())
      expect(fake.messages).toHaveLength(0)
      const resumed = await post<{ campaign: Campaign }>(`/${campaign.id}/resume`, {})
      expect(resumed.data.campaign.status).toBe("sending")
      const cancelled = await post<{ campaign: Campaign }>(`/${campaign.id}/cancel`, {})
      expect(cancelled.data.campaign.status).toBe("cancelled")
      await campaignDispatch(getContainer())
      expect(fake.messages).toHaveLength(0)
      const again = await post(`/${campaign.id}/resume`, {})
      expect([again.status, again.data.message]).toEqual([409, "campaigns.status_conflict"])
    })

    it("gives a person's rows in a KVKK copy and removes them with an erasure", async () => {
      const campaign = await draft()
      await post(`/${campaign.id}/send`, {})
      await campaignDispatch(getContainer())
      const [customer] = await getContainer()
        .resolve(Modules.CUSTOMER)
        .listCustomers({ email: people.ayse }, { select: ["id"] })
      const id = customer?.id ?? ""
      const copy = await campaignMessagesFor(getContainer(), id, [people.ayse])
      expect(copy).toEqual([
        expect.objectContaining({ kampanya: "Kış indirimi", kanal: "email", durum: "sent" }),
      ])
      expect(await eraseCampaignRecipients(getContainer(), id, [people.ayse])).toBe(1)
      expect(await campaignMessagesFor(getContainer(), id, [people.ayse])).toEqual([])
    })

    // Last: the day's counter it fills stays for the rest of the file's run
    it("waits when the day's quota is spent and goes on once there is room", async () => {
      await settings().saveSection("notifications", { email_daily_limit: 100 }, null)
      const day = new Date().toISOString().slice(0, 10)
      for (let sent = 0; sent < 100; sent += 1) {
        await sharedRateLimitStore().hit(`email:commercial:${day}`, 24 * 60 * 60 * 1000)
      }
      const campaign = await draft()
      await post(`/${campaign.id}/send`, {})
      await campaignDispatch(getContainer())
      const paused = await get<{ campaign: Campaign & { paused_reason: string } }>(
        `/${campaign.id}`
      )
      expect(paused.data.campaign).toMatchObject({ status: "paused", paused_reason: "quota" })
      expect(mailsTo(people.ayse)).toHaveLength(0)

      await settings().saveSection("notifications", { email_daily_limit: 200_000 }, null)
      await campaignDispatch(getContainer())
      expect(mailsTo(people.ayse)).toHaveLength(1)
      expect((await get<{ campaign: Campaign }>(`/${campaign.id}`)).data.campaign.status).toBe(
        "sent"
      )
    })
  },
})
