import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Preview {
  name: string
  kind: string
  email: { subject: string; html: string; text: string } | null
  sms: string | null
  message?: string
}

/** F9.3 (adr/0036): the panel's preview of each message, in the shop's brand; nothing is sent. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const PATH = "/admin/messaging/templates"

    const get = <T>(path: string, headers = admin.headers) =>
      settle(http.get<T & { message?: string }>(path, { headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("lists every template and previews one in the shop's name, escaped, not cached", async () => {
      const stores = getContainer().resolve(Modules.STORE)
      const [store] = await stores.listStores({}, { take: 1 })
      await stores.updateStores(store?.id ?? "", { name: "Örnek <b>Mağaza</b>" })

      const list = await get<{ templates: { name: string; kind: string; channels: string[] }[] }>(
        PATH
      )
      const preview = await get<Preview>(`${PATH}/order.placed/preview`)

      expect(list.status).toBe(200)
      // adr/0068: the wholesaler's invitation and opened account made it 37
      expect(list.data.templates).toHaveLength(37)
      expect(list.data.templates.map((template) => template.name)).toEqual(
        expect.arrayContaining(["account.wholesale_invite", "account.wholesale_enabled"])
      )
      // Units refused at receipt, a sealed good opened (adr/0032 Ek 2026-11-03)
      expect(list.data.templates).toContainEqual({
        name: "return.refused",
        kind: "transactional",
        channels: ["email"],
      })
      // An approved request staff took back before anything came back (order #691)
      expect(list.data.templates).toContainEqual({
        name: "return.canceled",
        kind: "transactional",
        channels: ["email"],
      })
      // A bulk e-mail or SMS to one consented recipient (adr/0050)
      expect(list.data.templates).toContainEqual({
        name: "marketing.campaign",
        kind: "commercial",
        channels: ["email", "sms"],
      })
      // A sold gift card's codes to its recipient (adr/0025 Ek 2026-11-03)
      expect(list.data.templates).toContainEqual({
        name: "gift_card.issued",
        kind: "transactional",
        channels: ["email"],
      })
      // A staff member told their 2FA changed (the F15 audit)
      expect(list.data.templates).toContainEqual({
        name: "staff.mfa_changed",
        kind: "transactional",
        channels: ["email"],
      })
      // A moved customer asked to open their account (F14.5)
      expect(list.data.templates).toContainEqual({
        name: "account.migration_invite",
        kind: "transactional",
        channels: ["email"],
      })
      // The buyer's invoice is ready (F8)
      expect(list.data.templates).toContainEqual({
        name: "order.invoiced",
        kind: "transactional",
        channels: ["email"],
      })
      expect(list.data.templates).toContainEqual({
        name: "marketing.announcement",
        kind: "commercial",
        channels: ["email", "sms"],
      })
      // Double opt-in's confirmation, by e-mail or SMS as the consent was asked for
      expect(list.data.templates).toContainEqual({
        name: "consent.confirm",
        kind: "transactional",
        channels: ["email", "sms"],
      })
      expect(preview.status).toBe(200)
      expect(preview.headers["cache-control"]).toBe("no-store")
      expect(preview.data).toMatchObject({ name: "order.placed", kind: "transactional" })
      expect(preview.data.email?.subject).toContain("#1042")
      expect(preview.data.email?.html).toContain("Örnek &lt;b&gt;Mağaza&lt;/b&gt;")
      expect(preview.data.email?.html).not.toContain("<b>Mağaza</b>")
      expect(preview.data.sms).toContain("#1042")
    })

    it("previews with the shop's own address, legal identity, bank account and way to refuse", async () => {
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      const blank = await get<Preview>(`${PATH}/marketing.campaign/preview`)
      await settings.saveSection("seo", { canonical_host: "atolye.com.tr" }, null)
      await settings.saveSection(
        "legal",
        { company_title: "Atölye Ticaret A.Ş.", mersis: "0987654321000017" },
        null
      )
      await settings.saveSection(
        "marketing",
        { sms_opt_out_text: "Ret için RET yazıp 4600'e gönderin." },
        null
      )
      await settings.saveSection(
        "bank_transfer",
        {
          enabled: true,
          account_holder: "Atölye Ticaret A.Ş.",
          bank_name: "Ziraat Bankası",
          iban: "TR33 0006 1005 1978 6457 8413 26",
        },
        null
      )

      const campaign = await get<Preview>(`${PATH}/marketing.campaign/preview`)
      const order = await get<Preview>(`${PATH}/order.placed/preview`)
      const reminder = await get<Preview>(`${PATH}/cart.reminder/preview`)

      // Nothing filled yet: the made-up identity stands in, marked as such nowhere
      expect(blank.data.email?.html).toContain("MERSİS 0123456789000015")
      expect(campaign.data.email?.html).toContain("Atölye Ticaret A.Ş. · MERSİS 0987654321000017")
      expect(campaign.data.email?.html).toContain("https://atolye.com.tr/abonelik/cik?t=preview")
      expect(campaign.data.sms).toContain("Ret için RET yazıp 4600'e gönderin.")
      expect(campaign.data.sms).not.toContain("ORNEK")
      expect(order.data.email?.text).toContain("TR33 0006 1005 1978 6457 8413 26")
      expect(order.data.email?.text).toContain("Ziraat Bankası")
      expect(order.data.email?.text).not.toContain("Örnek Bank")
      expect(reminder.data.email?.html).toContain("https://atolye.com.tr/sepet")
      for (const preview of [campaign, order, reminder]) {
        expect(JSON.stringify(preview.data)).not.toContain("magaza.example")
      }
    })

    it("answers an unknown template, or an object's own key, with not found", async () => {
      const unknown = await get<Preview>(`${PATH}/order.lost/preview`)
      const inherited = await get<Preview>(`${PATH}/constructor/preview`)

      expect(unknown.status).toBe(404)
      expect(unknown.data.message).toBe("messaging.template_unknown")
      expect(inherited.status).toBe(404)
    })

    it("shows nothing to a visitor without a staff session", async () => {
      const list = await get<unknown>(PATH, {})
      const preview = await get<unknown>(`${PATH}/order.placed/preview`, {})

      expect(list.status).toBe(401)
      expect(preview.status).toBe(401)
    })
  },
})
