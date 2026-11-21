import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeSecret } from "@qticaret/testing"
import { composeSms, smsLength } from "../../src/lib/campaigns/sms"
import { resetAiBreakers } from "../../src/lib/ai/breaker"
import { fakeTextConnector } from "../../src/lib/ai/connectors/fake"
import type { TextRequest } from "../../src/lib/ai/connectors/types"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { brandOf } from "../../src/workflows/messaging/brand"
import { createAdminUser } from "../helpers/admin"
import { aiProduct, connectFake, pushPlan, storedRunsWith } from "../helpers/ai"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

const OPT_OUT = "Ret için RET yazıp 4600'e gönderin."
// A customer the campaign would reach: none of it may go to the service
const CUSTOMER = {
  first_name: "Zeynep",
  last_name: "Gizlisoy",
  email: "zeynep.gizlisoy@example.com",
  phone: "+905321112233",
}

interface Answer {
  suggestion?: { id: string; text: string; candidates: string[] }
  message?: string
}

/**
 * adr/0074 §5 madde 6: a bulk message's words on the fake service. The
 * data block is the saved campaign's own words and the names of the
 * published storefront products its cards show; its audience, a
 * customer's name, e-mail or phone never go. Only owner and admin ask
 * (the bulk messages' writers); the shop's guidance applies; an SMS text
 * fits one part with the shop's name and opt-out line.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    const key = `test-key-${fakeSecret()}`
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const ask = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post<Answer>("/admin/ai/suggestions", body, { headers }))
    const create = async (body: Record<string, unknown>) => {
      const created = await settle(
        http.post<{ campaign: { id: string } }>(
          "/admin/bulk-messages",
          { audience: [{ kind: "all_consented" }], ...body },
          { headers: owner.headers }
        )
      )
      expect(created.status).toBe(201)
      return created.data.campaign.id
    }

    managedForThisFile()

    beforeEach(async () => {
      resetAiBreakers()
      await pushPlan(http, true)
      owner = await createAdminUser(http, getContainer())
      await connectFake(http, owner.headers, key)
      await settings().setFeature("marketing.campaigns", true, null)
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      await settings().saveSection("marketing", { sms_opt_out_text: OPT_OUT }, null)
      await getContainer().resolve(Modules.CUSTOMER).createCustomers(CUSTOMER)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    /** The fake service's own answers, each request kept. */
    function watching(): TextRequest[] {
      const seen: TextRequest[] = []
      const complete = fakeTextConnector.complete.bind(fakeTextConnector)
      jest.spyOn(fakeTextConnector, "complete").mockImplementation((request) => {
        seen.push(request)
        return complete(request)
      })
      return seen
    }

    it("writes an e-mail from the campaign's own words and shown products, nothing of its audience", async () => {
      const shown = await aiProduct(getContainer(), "Yün Atkı Kışlık")
      const hidden = await aiProduct(getContainer(), "Taslak Bere Gizli")
      await getContainer().resolve(Modules.PRODUCT).updateProducts(hidden, { status: "draft" })
      const id = await create({
        name: "Kasım %20 indirim",
        channel: "email",
        subject: "Kasım fırsatları",
        body: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Kış seçkimiz raflarda." }] },
            { type: "productCard", attrs: { id: shown } },
            { type: "productCard", attrs: { id: hidden } },
          ],
        },
      })
      const seen = watching()
      const answered = await ask(owner.headers, {
        task: "campaign_email",
        entity_type: "campaign",
        entity_id: id,
        option: "discount",
      })
      expect(answered.status).toBe(201)
      const email = JSON.parse(answered.data.suggestion?.text ?? "{}") as { subjects?: string[] }
      expect(email.subjects).toHaveLength(3)
      // The subject picked is its place among the three; the whole JSON comes back
      const takeAt = (candidate_index: number) =>
        settle(
          http.post<{ suggestion: { text: string; candidate_index: number } }>(
            `/admin/ai/suggestions/${answered.data.suggestion?.id ?? ""}/accept`,
            { candidate_index },
            { headers: owner.headers }
          )
        )
      const unknown = await takeAt(3)
      expect([unknown.status, unknown.data.message]).toEqual([400, "ai.candidate_unknown"])
      const taken = await takeAt(2)
      expect(taken.status).toBe(200)
      expect(taken.data.suggestion.candidate_index).toBe(2)
      expect(taken.data.suggestion.text).toBe(answered.data.suggestion?.text)
      const request = seen[0]
      expect(request?.json).toBe(true)
      expect(request?.system).toContain("Amaç indirim")
      expect(request?.data).toContain("Kasım %20 indirim")
      expect(request?.data).toContain("Yün Atkı Kışlık")
      expect(request?.data).toContain("Kış seçkimiz raflarda.")
      expect(request?.data).not.toContain("Taslak Bere Gizli")
      for (const leak of [...Object.values(CUSTOMER), "all_consented", owner.email]) {
        expect(request?.data).not.toContain(leak)
        expect(request?.system).not.toContain(leak)
      }
      // Nor kept in any workflow's stored state
      for (const leak of Object.values(CUSTOMER)) {
        expect(await storedRunsWith(getContainer(), leak)).toBe(0)
      }
    })

    it("lets only owner and admin ask, with the shop's guidance, for the campaign's own channel", async () => {
      const id = await create({ name: "Yeni sezon", channel: "email", subject: "Yeni sezon" })
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const saved = await settle(
        http.post(
          "/admin/platform-settings/ai_guidance",
          { tasks: { campaign_email: { extra: "Konu satırında soru sor." } } },
          { headers: owner.headers }
        )
      )
      expect(saved.status).toBe(200)
      const seen = watching()
      const body = { task: "campaign_email", entity_type: "campaign", entity_id: id }

      expect((await ask(admin.headers, body)).status).toBe(201)
      expect(seen[0]?.system).toContain("Konu satırında soru sor.")
      expect((await ask(operations.headers, body)).status).toBe(403)
      expect((await ask(readonly.headers, body)).status).toBe(403)

      const wrong = await ask(owner.headers, { ...body, task: "campaign_sms" })
      expect([wrong.status, wrong.data.message]).toEqual([400, "ai.unknown_entity"])
      expect((await ask(owner.headers, { ...body, option: "serbest" })).status).toBe(400)
      // A campaign's task is asked for a campaign only
      const product = await aiProduct(getContainer())
      const other = await ask(owner.headers, {
        ...body,
        entity_type: "product",
        entity_id: product,
      })
      expect([other.status, other.data.message]).toEqual([400, "ai.unknown_entity"])
    })

    it("refuses to write or take a message's words while bulk messages are off", async () => {
      const id = await create({ name: "Yeni sezon", channel: "email", subject: "Yeni sezon" })
      const body = { task: "campaign_email", entity_type: "campaign", entity_id: id }
      const answered = await ask(owner.headers, body)
      expect(answered.status).toBe(201)
      await settings().setFeature("marketing.campaigns", false, null)

      const refused = await ask(owner.headers, body)
      expect([refused.status, refused.data.message]).toEqual([403, "ai.feature_off"])
      // A draft asked before the feature was turned off is not taken after
      const taken = await settle(
        http.post(
          `/admin/ai/suggestions/${answered.data.suggestion?.id ?? ""}/accept`,
          { candidate_index: 0 },
          { headers: owner.headers }
        )
      )
      expect([taken.status, taken.data.message]).toEqual([403, "ai.feature_off"])
    })

    it("offers texts that fit one SMS with the shop's name and opt-out line, one picked", async () => {
      const id = await create({ name: "Kış seçkisi", channel: "sms", sms_text: "Kış geldi" })
      const seen = watching()
      const answered = await ask(owner.headers, {
        task: "campaign_sms",
        entity_type: "campaign",
        entity_id: id,
        option: "season",
      })
      expect(answered.status).toBe(201)
      const candidates = answered.data.suggestion?.candidates ?? []
      expect(candidates.length).toBeGreaterThan(1)
      const { shopName } = await brandOf(getContainer())
      for (const text of candidates) {
        expect(smsLength(composeSms(text, shopName, OPT_OUT)).parts).toBe(1)
      }
      expect(seen[0]?.data).toContain("sms_max_chars")
      expect(seen[0]?.data).not.toContain(OPT_OUT)
      expect(seen[0]?.data).not.toContain(CUSTOMER.phone)

      const accepted = await settle(
        http.post<{ suggestion: { text: string; candidate_index: number } }>(
          `/admin/ai/suggestions/${answered.data.suggestion?.id ?? ""}/accept`,
          { candidate_index: 1 },
          { headers: owner.headers }
        )
      )
      expect(accepted.status).toBe(200)
      expect(accepted.data.suggestion.text).toBe(candidates[1])
    })
  },
})
