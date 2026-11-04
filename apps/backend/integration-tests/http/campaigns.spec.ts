import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import campaignDispatch from "../../src/jobs/campaign-dispatch"
import { CAMPAIGNS_MODULE } from "../../src/modules/campaigns"
import type CampaignsModuleService from "../../src/modules/campaigns/service"
import type { Campaign } from "../helpers/campaigns"
import { campaignFixture } from "../helpers/campaigns"
import type { HttpClient } from "../helpers/http"

jest.setTimeout(180 * 1000)

/**
 * adr/0050: bulk e-mail to consented customers and subscribers, through
 * deliver(): the draft, its audience, a test, the send and a schedule.
 * Pausing, roles, erasure and the day's quota: `campaigns-lifecycle.spec.ts`.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const f = campaignFixture(http, getContainer)

    it("answers as a missing route while the shop has the flag off", async () => {
      await f.settings().setFeature("marketing.campaigns", false, null)
      expect((await f.get("")).status).toBe(404)
    })

    it("keeps a draft, refuses an unknown token, and counts the audience without naming anyone", async () => {
      const campaign = await f.draft()
      expect(campaign).toMatchObject({ status: "draft", counts: { sent: 0 } })
      const misspelt = await f.post(`/${campaign.id}`, { subject: "{isim}, fırsat" })
      expect([misspelt.status, misspelt.data.message]).toEqual([400, "campaigns.token_unknown"])

      const preview = await f.post<{ audience: number; eligible: number; excluded: object }>(
        `/${campaign.id}/audience-preview`,
        {}
      )
      expect(preview.data).toMatchObject({
        audience: 4,
        eligible: 1,
        excluded: { no_consent: 1, iys_pending: 1, suppressed: 1, recent: 0 },
      })
      const withSubscribers = await f.post<{ eligible: number }>(
        `/${campaign.id}/audience-preview`,
        {
          audience: [{ kind: "group", id: f.groupId }, { kind: "newsletter" }],
        }
      )
      expect(withSubscribers.data.eligible).toBe(2)
      expect(JSON.stringify([preview.data, withSubscribers.data])).not.toContain("@")
    })

    it("sends a test to the asking staff member's own address only", async () => {
      const campaign = await f.draft()
      const elsewhere = await f.post(`/${campaign.id}/test-send`, { to: f.people.cem })
      expect(elsewhere.status).toBe(400)
      const test = await f.post<{ sent: boolean }>(`/${campaign.id}/test-send`, {})
      expect(test.status).toBe(200)
      expect(f.fake.messages).toHaveLength(1)
      expect(f.fake.messages[0]?.to).toEqual([f.admin.email])
      expect(f.fake.messages[0]?.subject).toMatch(/^\[Deneme\] /)
      expect(f.mailsTo(f.people.ayse)).toHaveLength(0)
    })

    it("sends after re-authentication, to consented recipients once, with the way out", async () => {
      const campaign = await f.draft([{ kind: "group", id: f.groupId }, { kind: "newsletter" }])
      const bare = await f.post(`/${campaign.id}/send`, {}, f.admin.plain)
      expect([bare.status, bare.data.message]).toEqual([428, "staff.reauth_required"])
      const sent = await f.post<{ campaign: Campaign }>(`/${campaign.id}/send`, {})
      expect(sent.data.campaign.status).toBe("sending")

      await campaignDispatch(getContainer())
      expect(f.fake.messages.map(({ to }) => to[0]).sort()).toEqual(
        [f.people.ayse, f.people.abone].sort()
      )
      const [toAyse] = f.mailsTo(f.people.ayse)
      expect(toAyse?.subject).toBe("Ayşe, kış indirimi başladı")
      expect(toAyse?.html).toContain("Merhaba Ayşe")
      expect(toAyse?.html).toContain("utm_campaign=")
      expect(toAyse?.headers["List-Unsubscribe"]).toContain(
        "https://api.magaza.example/unsubscribe"
      )
      expect(toAyse?.html).toContain("Bu iletileri almak istemiyorum")
      // A subscriber has no name on record: the greeting every shopper gets
      expect(f.mailsTo(f.people.abone)[0]?.html).toContain("Merhaba Değerli müşterimiz")

      await campaignDispatch(getContainer())
      expect(f.fake.messages).toHaveLength(2)
      const report = await f.get<{ report: { status: string; counts: Record<string, unknown> } }>(
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
        JSON.stringify([report.data, rows, (await f.get(`/${campaign.id}`)).data])
      ).not.toContain("@")

      // Within 24 hours the same people get no other bulk message
      const copy = await f.post<{ campaign: Campaign }>(`/${campaign.id}/copy`, {})
      const again = await f.post<{ eligible: number; excluded: { recent: number } }>(
        `/${copy.data.campaign.id}/audience-preview`,
        {}
      )
      expect(again.data).toMatchObject({ eligible: 0, excluded: { recent: 2 } })
    })

    it("locks a scheduled campaign's content and starts it when its time comes", async () => {
      const campaign = await f.draft()
      const past = await f.post(`/${campaign.id}/schedule`, {
        scheduled_at: "2020-01-01T09:00:00Z",
      })
      expect([past.status, past.data.message]).toEqual([400, "campaigns.schedule_invalid"])
      const later = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const bare = await f.post(`/${campaign.id}/schedule`, { scheduled_at: later }, f.admin.plain)
      expect(bare.status).toBe(428)
      const scheduled = await f.post<{ campaign: Campaign }>(`/${campaign.id}/schedule`, {
        scheduled_at: later,
      })
      expect(scheduled.data.campaign.status).toBe("scheduled")
      const edit = await f.post(`/${campaign.id}`, { name: "Başka" })
      expect([edit.status, edit.data.message]).toEqual([409, "campaigns.locked"])

      await campaignDispatch(getContainer())
      expect(f.fake.messages).toHaveLength(0)
      await getContainer()
        .resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
        .updateBulkMessages({ id: campaign.id, scheduled_at: new Date(Date.now() - 1000) })
      await campaignDispatch(getContainer())
      expect(f.fake.messages.map(({ to }) => to[0])).toEqual([f.people.ayse])
    })
  },
})
