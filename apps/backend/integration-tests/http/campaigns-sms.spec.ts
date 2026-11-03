import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { LONGEST_NAME, SMS_MAX_PARTS, composeSms, smsLength } from "../../src/lib/campaigns/sms"
import { fillName } from "../../src/lib/campaigns/tokens"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { brandOf } from "../../src/workflows/messaging/brand"
import { GREETING } from "../../src/workflows/messaging/loaders/types"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

const OPT_OUT = "Ret için RET yazıp 4600'e gönderin."
const LINK = "https://magaza.example/indirim"

interface Campaign {
  id: string
  status: string
}

/** adr/0050 §4: a text counted as it goes, its shop links' utm and the longest name in it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let shopName: string

    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const post = <T>(path: string, body: unknown) =>
      settle(
        http.post<T & { message?: string }>(`/admin/bulk-messages${path}`, body, {
          headers: admin.headers,
        })
      )
    const get = <T>(path: string) =>
      settle(
        http.get<T & { message?: string }>(`/admin/bulk-messages${path}`, {
          headers: admin.headers,
        })
      )
    const save = (sms_text: string) =>
      post<{ campaign: Campaign }>("", {
        name: "Kış indirimi",
        channel: "sms",
        audience: [{ kind: "all_consented" }],
        sms_text,
      })

    /** The count before (adr/0050 open items): as typed, the greeting for `{ad}`, no utm. */
    const asTyped = (text: string) =>
      smsLength(composeSms(fillName(text, GREETING), shopName, OPT_OUT))
    /** `head`, `a`s up to the last septet `parts` hold as typed, `tail`. */
    const atTheEdge = (head: string, tail: string, parts: number): string => {
      const room = parts === 1 ? 155 : parts * 149
      return `${head}${"a".repeat(room - asTyped(`${head}${tail}`).units)}${tail}`
    }

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      await container.resolve(Modules.USER).updateUsers({ id: admin.userId, first_name: "Selin" })
      await settings().setFeature("marketing.campaigns", true, null)
      await settings().saveSection("seo", { canonical_host: "magaza.example" }, null)
      await settings().saveSection("marketing", { sms_opt_out_text: OPT_OUT }, null)
      shopName = (await brandOf(container)).shopName
    })

    it("refuses a text that a shop link's utm and the longest name push past three parts", async () => {
      const text = atTheEdge("{ad}, kış indirimi başladı ", ` ${LINK}`, SMS_MAX_PARTS)
      expect(asTyped(text).parts).toBe(SMS_MAX_PARTS)
      const created = await save(text)
      expect([created.status, created.data.message]).toEqual([400, "campaigns.sms_too_long"])

      const short = await save("Kış indirimi başladı")
      expect(short.status).toBe(201)
      const changed = await post(`/${short.data.campaign.id}`, { sms_text: text })
      expect([changed.status, changed.data.message]).toEqual([400, "campaigns.sms_too_long"])
    })

    it("counts a text with a link alike in audience-preview and the preview", async () => {
      // One part as typed; two with the utm and the longest name
      const text = atTheEdge("{ad}, kış indirimi ", ` ${LINK}`, 1)
      expect(asTyped(text).parts).toBe(1)
      const { data } = await save(text)
      const preview = await get<{ text: string; parts: number }>(
        `/${data.campaign.id}/preview?channel=sms`
      )
      expect(preview.status).toBe(200)
      expect(preview.data.text).toContain("utm_medium=sms")
      expect(preview.data.text.startsWith("Selin, ")).toBe(true)
      const counted = await post<{ sms: { parts: number; max_parts: number } }>(
        `/${data.campaign.id}/audience-preview`,
        {}
      )
      expect(counted.data.sms).toEqual({ parts: 2, max_parts: SMS_MAX_PARTS })
      expect(preview.data.parts).toBe(counted.data.sms.parts)
      // The shown text at the longest name is what both count
      expect(smsLength(preview.data.text.replace("Selin", LONGEST_NAME)).parts).toBe(2)
    })

    it("refuses to send or schedule a text the opt-out line has since made longer", async () => {
      const text = atTheEdge("Kış indirimi başladı ", " Son gün yarın.", SMS_MAX_PARTS)
      const { data, status } = await save(text)
      expect(status).toBe(201)
      await settings().saveSection(
        "marketing",
        { sms_opt_out_text: `${OPT_OUT} Bilgi: 0850 000 00 00.` },
        null
      )
      const sent = await post(`/${data.campaign.id}/send`, {})
      expect([sent.status, sent.data.message]).toEqual([400, "campaigns.sms_too_long"])
      const later = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const scheduled = await post(`/${data.campaign.id}/schedule`, { scheduled_at: later })
      expect([scheduled.status, scheduled.data.message]).toEqual([400, "campaigns.sms_too_long"])
      const after = await get<{ campaign: Campaign }>(`/${data.campaign.id}`)
      expect(after.data.campaign.status).toBe("draft")
    })
  },
})
