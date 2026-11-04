import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sharedRateLimitStore } from "../../src/api/http/rate-limit"
import campaignDispatch from "../../src/jobs/campaign-dispatch"
import {
  campaignMessagesFor,
  eraseCampaignRecipients,
} from "../../src/workflows/campaigns/customer-data"
import { createAdminUser } from "../helpers/admin"
import type { Campaign } from "../helpers/campaigns"
import { campaignFixture } from "../helpers/campaigns"
import type { HttpClient } from "../helpers/http"

jest.setTimeout(180 * 1000)

/**
 * adr/0050: a bulk message's life after its draft: who may write one, the
 * SMS account it needs, pausing and cancelling, a person's rows in a KVKK
 * copy and erasure, and the day's quota.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const f = campaignFixture(http, getContainer)

    it("lets the operations role read bulk messages but write none", async () => {
      const campaign = await f.draft()
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await f.get("", operations.headers)).status).toBe(200)
      expect(
        (await f.post("", { name: "x", channel: "email", audience: [] }, operations.headers)).status
      ).toBe(403)
      expect((await f.post(`/${campaign.id}/send`, {}, operations.headers)).status).toBe(403)
    })

    it("refuses a text campaign without the shop's SMS account", async () => {
      const { data } = await f.post<{ campaign: Campaign }>("", {
        name: "SMS",
        channel: "sms",
        audience: [{ kind: "all_consented" }],
        sms_text: "Kış indirimi başladı",
      })
      const sent = await f.post(`/${data.campaign.id}/send`, {})
      expect([sent.status, sent.data.message]).toEqual([400, "campaigns.sms_account_missing"])
    })

    it("lets staff pause, resume and cancel a sending campaign", async () => {
      const campaign = await f.draft()
      await f.post(`/${campaign.id}/send`, {})
      const paused = await f.post<{ campaign: Campaign & { paused_reason: string } }>(
        `/${campaign.id}/pause`,
        {}
      )
      expect(paused.data.campaign).toMatchObject({ status: "paused", paused_reason: "staff" })
      // A pause staff made waits for staff
      await campaignDispatch(getContainer())
      expect(f.fake.messages).toHaveLength(0)
      const resumed = await f.post<{ campaign: Campaign }>(`/${campaign.id}/resume`, {})
      expect(resumed.data.campaign.status).toBe("sending")
      const cancelled = await f.post<{ campaign: Campaign }>(`/${campaign.id}/cancel`, {})
      expect(cancelled.data.campaign.status).toBe("cancelled")
      await campaignDispatch(getContainer())
      expect(f.fake.messages).toHaveLength(0)
      const again = await f.post(`/${campaign.id}/resume`, {})
      expect([again.status, again.data.message]).toEqual([409, "campaigns.status_conflict"])
    })

    it("gives a person's rows in a KVKK copy and removes them with an erasure", async () => {
      const campaign = await f.draft()
      await f.post(`/${campaign.id}/send`, {})
      await campaignDispatch(getContainer())
      const [customer] = await getContainer()
        .resolve(Modules.CUSTOMER)
        .listCustomers({ email: f.people.ayse }, { select: ["id"] })
      const id = customer?.id ?? ""
      const copy = await campaignMessagesFor(getContainer(), id, [f.people.ayse])
      expect(copy).toEqual([
        expect.objectContaining({ kampanya: "Kış indirimi", kanal: "email", durum: "sent" }),
      ])
      expect(await eraseCampaignRecipients(getContainer(), id, [f.people.ayse])).toBe(1)
      expect(await campaignMessagesFor(getContainer(), id, [f.people.ayse])).toEqual([])
    })

    // Last: the day's counter it fills stays for the rest of the file's run
    it("waits when the day's quota is spent and goes on once there is room", async () => {
      await f.settings().saveSection("notifications", { email_daily_limit: 100 }, null)
      const day = new Date().toISOString().slice(0, 10)
      for (let sent = 0; sent < 100; sent += 1) {
        await sharedRateLimitStore().hit(`email:commercial:${day}`, 24 * 60 * 60 * 1000)
      }
      const campaign = await f.draft()
      await f.post(`/${campaign.id}/send`, {})
      await campaignDispatch(getContainer())
      const paused = await f.get<{ campaign: Campaign & { paused_reason: string } }>(
        `/${campaign.id}`
      )
      expect(paused.data.campaign).toMatchObject({ status: "paused", paused_reason: "quota" })
      expect(f.mailsTo(f.people.ayse)).toHaveLength(0)

      await f.settings().saveSection("notifications", { email_daily_limit: 200_000 }, null)
      await campaignDispatch(getContainer())
      expect(f.mailsTo(f.people.ayse)).toHaveLength(1)
      expect((await f.get<{ campaign: Campaign }>(`/${campaign.id}`)).data.campaign.status).toBe(
        "sent"
      )
    })
  },
})
