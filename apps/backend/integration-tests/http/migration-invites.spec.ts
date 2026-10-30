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
import { forgetMovedCustomers } from "../../src/workflows/migration/retention"
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
      // The sign-up page with the claim key; no address in the link
      expect(sent[0]?.html).toContain("https://magaza.example.com/hesap/kayit?davet=")
      expect(sent[0]?.html).not.toContain(encodeURIComponent(AYSE))
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

    it("gives a moved customer's account what moved only with the invitation's key", async () => {
      await move()
      const [guest] = await customers().listCustomers({ email: AYSE, has_account: false })
      const queued = await post<{ async_job: SheetJob }>("/admin/migrations/invites", {})
      await settled(queued.data.async_job.id)
      const mailed = await eventually(
        () => Promise.resolve(mail.messages.find((message) => message.to.includes(AYSE))),
        (message) => message !== undefined
      )
      const token = decodeURIComponent(/davet=([^"&<\s]+)/.exec(mailed?.html ?? "")?.[1] ?? "")
      expect(token).not.toBe("")

      const store = await createStorefront(getContainer())
      const account = await registerCustomer(http, store, AYSE)
      const me = () =>
        http.get<{ customer: { addresses: { address_1: string }[] } }>("/store/customers/me", {
          headers: account.headers,
        })
      const claim = (headers: Record<string, string>, body: Record<string, unknown>) =>
        settle(
          http.post<{ claimed?: Record<string, number>; message?: string }>(
            "/store/customers/me/migration-claim",
            body,
            { headers }
          )
        )
      // A confirmed address alone takes nothing (closing review)
      await me()
      expect(await migration().listLegacyOrders({ customer_id: account.id })).toHaveLength(0)

      // Another account, the key forwarded to it: not its record
      const stranger = await registerCustomer(http, store)
      const foreign = await claim(stranger.headers, { token })
      expect(foreign.status).toBe(400)
      expect(foreign.data.message).toBe("migration.claim_not_yours")
      expect((await claim(account.headers, { token: `${token}x` })).status).toBe(400)

      const taken = await claim(account.headers, { token })
      expect(taken.status).toBe(200)
      expect(taken.data.claimed).toMatchObject({ orders: 1, reviews: 1, addresses: 1 })
      const orders = await migration().listLegacyOrders({ customer_id: account.id })
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
      const { data } = await me()
      expect(data.customer.addresses.map((address) => address.address_1)).toEqual(["Atatürk Cd. 1"])

      // Taken once
      const again = await claim(account.headers, { token })
      expect(again.status).toBe(409)
      expect(again.data.message).toBe("migration.claim_used")
    })

    it("moves the old platform's customer list, its own export, nobody twice", async () => {
      const list =
        "E-Posta Adresi;Adı Soyadı;Cep Telefonu;İl;İlçe;Açık Adres;E-Posta İzni\n" +
        "liste.ayse@example.com;Ayşe Kaya;05321112233;İstanbul;Kadıköy;Bağdat Cd. 1;15.03.2024\n" +
        "liste.can@example.com;Can Demir;;;;;Evet\n"
      const upload = async (mode: "check" | "apply") => {
        const queued = await settle(
          http.post<{ async_job: SheetJob }>(
            `/admin/migrations/customers?mode=${mode}`,
            Buffer.from(list),
            {
              headers: { ...owner.headers, "content-type": "text/csv" },
            }
          )
        )
        expect(queued.status).toBe(202)
        const job = await settled(queued.data.async_job.id)
        expect(job.status).toBe("succeeded")
        return (job.result_summary as { counts: Record<string, Record<string, number>> }).counts
      }
      expect(await upload("check")).toMatchObject({
        customer: { read: 2, created: 2 },
        consent: { created: 1 },
        product: { read: 0 },
      })
      expect(await upload("apply")).toMatchObject({
        customer: { created: 2 },
        consent: { created: 1 },
      })
      const [ayse] = await customers().listCustomers(
        { email: "liste.ayse@example.com" },
        { relations: ["addresses"] }
      )
      expect(ayse).toMatchObject({ first_name: "Ayşe", last_name: "Kaya", has_account: false })
      expect(ayse?.addresses.map((address) => address.city)).toEqual(["Kadıköy"])
      expect(await upload("apply")).toMatchObject({ customer: { created: 0, found: 2 } })
    })

    it("forgets the moved customers' records ninety days after cutover, an open invitation's after it lapses", async () => {
      await move()
      const marked = await post<{ cutover: { cutover_at: string } }>(
        "/admin/migrations/cutover",
        {}
      )
      const at = new Date(marked.data.cutover.cutover_at).getTime()
      const day = 24 * 60 * 60 * 1000
      const count = async () => (await migration().listMigrationItems({ kind: "customer" })).length
      const before = await count()
      expect(before).toBeGreaterThan(0)
      expect(await forgetMovedCustomers(getContainer(), new Date(at + 89 * day))).toBe(0)
      // One invited lately waits for its key to lapse
      const [recent] = await migration().listMigrationItems({ kind: "customer", status: "done" })
      await migration().updateMigrationItems({
        id: recent?.id ?? "",
        invited_at: new Date(at + 80 * day),
      })
      expect(await forgetMovedCustomers(getContainer(), new Date(at + 91 * day))).toBe(before - 1)
      expect(await count()).toBe(1)
      expect(await forgetMovedCustomers(getContainer(), new Date(at + 141 * day))).toBe(1)
      expect(await migration().listMigrationItems({ kind: "product" })).not.toHaveLength(0)
    })
  },
})
