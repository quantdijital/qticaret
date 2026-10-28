import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeNetgsm } from "@qticaret/testing"
import type { FakeNetgsm } from "@qticaret/testing"
import iysSync from "../../src/jobs/iys-sync"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

const randomPhone = () => `053${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`

interface IysSummary {
  brand_code_set: boolean
  pending: number
  sent: number
  failed: number
}

/** F10 M11 (adr/0038 §2): consents told to İYS through the shop's Netgsm account. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let netgsm: FakeNetgsm
    let admin: { headers: Record<string, string> }

    const messaging = () => getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE)
    const connect = (brandCode?: string) =>
      settle(
        http.post(
          "/admin/integrations/credentials/netgsm",
          {
            settings: { msgheader: "MAGAZA", ...(brandCode ? { iys_brand_code: brandCode } : {}) },
            secrets: { usercode: netgsm.account.usercode, password: netgsm.account.password },
          },
          { headers: admin.headers }
        )
      )
    const summary = async () =>
      (await http.get<{ iys: IysSummary }>("/admin/messaging/iys", { headers: admin.headers })).data
        .iys
    const customerWith = async (email: string, phone: string) => {
      const [customer] = await getContainer()
        .resolve(Modules.CUSTOMER)
        .createCustomers([{ email, phone, first_name: "İzin" }])
      return customer?.id ?? ""
    }
    const consent = (customerId: string, channel: string, status: string) =>
      http.post(
        `/admin/customers/${customerId}/consents`,
        {
          channel,
          status,
          ...(status === "granted" ? { evidence: "Mağazada imzalı izin formu" } : {}),
        },
        { headers: admin.headers }
      )

    beforeAll(async () => {
      netgsm = await startFakeNetgsm()
      process.env["NETGSM_BASE_URL"] = netgsm.url
    })

    afterAll(async () => {
      Reflect.deleteProperty(process.env, "NETGSM_BASE_URL")
      await netgsm.close()
    })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      netgsm.iys.length = 0
    })

    it("tells İYS of each consent once, a withdrawal too, as it was given", async () => {
      await connect(netgsm.account.brandCode)
      const email = `izinli-${randomUUID().slice(0, 8)}@example.com`
      const phone = randomPhone()
      const customerId = await customerWith(email, phone)
      await consent(customerId, "sms", "granted")
      const shopper = `vitrin-${randomUUID().slice(0, 8)}@example.com`
      await messaging().recordConsent({
        channel: "email",
        address: shopper,
        status: "granted",
        source: "checkout",
        evidence: { text_version: "test" },
      })

      await iysSync(getContainer())
      await iysSync(getContainer())
      const afterGrant = await summary()
      await consent(customerId, "sms", "revoked")
      await iysSync(getContainer())

      expect(netgsm.iys).toEqual([
        expect.objectContaining({
          type: "MESAJ",
          recipient: `+9${phone}`,
          status: "ONAY",
          source: "HS_FIZIKSEL_ORTAM",
          recipientType: "BIREYSEL",
        }),
        expect.objectContaining({
          type: "EPOSTA",
          recipient: shopper,
          status: "ONAY",
          source: "HS_WEB",
        }),
        expect.objectContaining({ type: "MESAJ", recipient: `+9${phone}`, status: "RET" }),
      ])
      // İYS reads Türkiye's time: 2026-10-29 00:13:08
      expect(netgsm.iys.map(({ consentDate }) => consentDate)).toEqual([
        expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/) as string,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/) as string,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/) as string,
      ])
      expect(afterGrant).toEqual({ brand_code_set: true, pending: 0, sent: 2, failed: 0 })
      expect(await summary()).toMatchObject({ pending: 0, sent: 2 })
    })

    it("keeps consents waiting without a brand code, and marks what İYS refuses", async () => {
      await connect()
      const customerId = await customerWith(
        `bekleyen-${randomUUID().slice(0, 8)}@example.com`,
        randomPhone()
      )
      await consent(customerId, "email", "granted")

      await iysSync(getContainer())
      const waiting = await summary()
      await connect(netgsm.account.brandCode)
      netgsm.queueIys("70")
      await iysSync(getContainer())
      const [row] = await messaging().listMessageConsents({ customer_id: customerId })

      expect(waiting).toEqual({ brand_code_set: false, pending: 1, sent: 0, failed: 0 })
      expect(netgsm.iys).toEqual([])
      expect(row).toMatchObject({ iys_status: "failed", iys_error: "iys_70" })
      expect(await summary()).toMatchObject({ pending: 0, failed: 1 })
    })

    it("refuses a brand code that is not digits", async () => {
      const saved = await connect("MARKA")

      expect(saved.status).toBe(400)
    })
  },
})
