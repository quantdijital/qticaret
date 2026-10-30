import type { ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { bundle, fileOf } from "../fixtures/migration-bundle"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(600 * 1000)

const ENV = ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"] as const
const AYSE = "ayse.tasinan@example.com"

/** F14.5 (adr/0042 §§5–6): moved customers asked to open their accounts, which take what moved. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let mail: FakeMail
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    const { settled } = sheetClient(http, getContainer, () => owner.headers)
    const migration = () => getContainer().resolve<MigrationModuleService>(MIGRATION_MODULE)
    const customers = () => getContainer().resolve<ICustomerModuleService>(Modules.CUSTOMER)

    const post = <T>(path: string, body: unknown, headers = owner.headers) =>
      settle(http.post<T & { message?: string }>(path, body, { headers }))
    const move = async () => {
      const queued = await settle(
        http.post<{ async_job: SheetJob }>("/admin/migrations?mode=apply", fileOf(bundle), {
          headers: { ...owner.headers, "content-type": "application/json" },
        })
      )
      expect((await settled(queued.data.async_job.id)).status).toBe("succeeded")
    }

    beforeAll(async () => {
      mail = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: mail.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await mail.close()
    })

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
      await stockShop(getContainer())
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      await settings.saveSection("notifications", { email_daily_limit: 200_000 }, null)
      mail.messages.length = 0
    })

    it("asks each moved customer once, none who has an account, linking the sign-up page", async () => {
      // An account opened before the migration: it needs no invitation
      await customers().createCustomers({ email: "zaten@example.com", has_account: true })
      await move()

      expect((await post("/admin/migrations/invites", {}, owner.plain)).status).toBe(428)
      const queued = await post<{ async_job: SheetJob }>("/admin/migrations/invites", {})
      expect(queued.status).toBe(202)
      const job = await settled(queued.data.async_job.id)
      expect(job.result_summary).toMatchObject({ queued: 2, sent: 1, stopped: null })
      const sent = await eventually(
        () => Promise.resolve(mail.messages.filter((message) => message.to.includes(AYSE))),
        (messages) => messages.length > 0
      )
      expect(sent).toHaveLength(1)
      expect(sent[0]?.html).toContain(
        `https://magaza.example.com/hesap/kayit?email=${encodeURIComponent(AYSE)}`
      )
      expect(mail.messages.some((message) => message.to.includes("zaten@example.com"))).toBe(false)
      const status = await http.get<{ invites: Record<string, number> }>(
        "/admin/migrations/invites",
        {
          headers: owner.headers,
        }
      )
      expect(status.data.invites).toMatchObject({ queued: 2, invited: 2, waiting: 0 })

      // Started again: nobody new, nobody twice
      const again = await post<{ async_job: SheetJob }>("/admin/migrations/invites", {})
      expect((await settled(again.data.async_job.id)).result_summary).toMatchObject({
        queued: 0,
        sent: 0,
      })
      expect(mail.messages.filter((message) => message.to.includes(AYSE))).toHaveLength(1)
    })

    it("gives a moved customer's account their old orders, reviews, consent and addresses at sign-in", async () => {
      await move()
      const [guest] = await customers().listCustomers({ email: AYSE, has_account: false })
      const store = await createStorefront(getContainer())
      const account = await registerCustomer(http, store, AYSE)
      expect(account.id).not.toBe(guest?.id)

      const me = () =>
        http.get<{ customer: { addresses: { address_1: string }[] } }>("/store/customers/me", {
          headers: account.headers,
        })
      await me()
      const orders = await eventually(
        () => migration().listLegacyOrders({ customer_id: account.id }),
        (rows) => rows.length > 0
      )
      expect(orders.map((order) => order.number)).toEqual(["1001"])
      const reviews = await getContainer()
        .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
        .listProductReviews({ customer_id: account.id })
      expect(reviews).toHaveLength(1)
      const consents = await getContainer()
        .resolve<MessagingModuleService>(MESSAGING_MODULE)
        .listMessageConsents({ customer_id: account.id })
      expect(consents.map((consent) => consent.channel)).toEqual(["email"])
      const [item] = await migration().listMigrationItems({
        kind: "customer",
        target_id: guest?.id ?? "",
      })
      expect(item?.adopted_at).not.toBeNull()

      // Signed in again: nothing twice
      const { data } = await me()
      expect(data.customer.addresses.map((address) => address.address_1)).toEqual(["Atatürk Cd. 1"])
    })
  },
})
