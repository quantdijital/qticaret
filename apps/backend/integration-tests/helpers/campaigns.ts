import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "./admin"
import type { HttpClient } from "./http"
import { settle } from "./http"

/**
 * The bulk e-mail suites' shop (adr/0050): a fake mail server, the flag on,
 * a verified sender domain, and a customer group of four with one
 * subscriber besides: Ayşe consented and told to İYS, Burak not told yet,
 * Cem without consent, Deniz suppressed, and a newsletter subscriber with
 * no customer record. Registers its own hooks; call it in `testSuite`.
 */

export const CAMPAIGN_BODY = {
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

export interface Campaign {
  id: string
  status: string
  counts: Record<string, unknown>
}

type Admin = Awaited<ReturnType<typeof createAdminUser>>
type People = Record<"ayse" | "burak" | "cem" | "deniz" | "abone", string>

export interface CampaignFixture {
  readonly fake: FakeMail
  readonly admin: Admin
  readonly groupId: string
  readonly people: People
  messaging: () => MessagingModuleService
  settings: () => PlatformSettingsModuleService
  mailsTo: (email: string) => FakeMail["messages"]
  post: <T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ) => Promise<{ status: number; data: T & { message?: string } }>
  get: <T>(
    path: string,
    headers?: Record<string, string>
  ) => Promise<{ status: number; data: T & { message?: string } }>
  /** A draft to the group, or to `audience`. */
  draft: (audience?: unknown[]) => Promise<Campaign>
}

export function campaignFixture(
  http: HttpClient,
  getContainer: () => MedusaContainer
): CampaignFixture {
  let fake: FakeMail | undefined
  let admin: Admin | undefined
  let groupId = ""
  let people: People = { ayse: "", burak: "", cem: "", deniz: "", abone: "" }
  const backend = process.env["BACKEND_URL"]

  const messaging = () => getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE)
  const settings = () =>
    getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const ready = <T>(value: T | undefined, what: string): T => {
    if (value === undefined) {
      throw new Error(`campaign fixture: ${what} is not set up yet`)
    }
    return value
  }
  const headersOf = (headers?: Record<string, string>) =>
    headers ?? ready(admin, "the admin").headers
  const post: CampaignFixture["post"] = <T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ) =>
    settle(
      http.post<T & { message?: string }>(`/admin/bulk-messages${path}`, body, {
        headers: headersOf(headers),
      })
    )
  const get: CampaignFixture["get"] = <T>(path: string, headers?: Record<string, string>) =>
    settle(
      http.get<T & { message?: string }>(`/admin/bulk-messages${path}`, {
        headers: headersOf(headers),
      })
    )

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
    await fake?.close()
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
    ready(fake, "the mail server").messages.length = 0
  })

  return {
    get fake() {
      return ready(fake, "the mail server")
    },
    get admin() {
      return ready(admin, "the admin")
    },
    get groupId() {
      return groupId
    },
    get people() {
      return people
    },
    messaging,
    settings,
    mailsTo: (email) =>
      ready(fake, "the mail server").messages.filter(({ to }) => to.includes(email)),
    post,
    get,
    draft: async (audience = [{ kind: "group", id: groupId }]) => {
      const { data, status } = await post<{ campaign: Campaign }>("", {
        name: "Kış indirimi",
        channel: "email",
        audience,
        subject: "{ad}, kış indirimi başladı",
        preheader: "Seçili ürünlerde %20",
        body: CAMPAIGN_BODY,
      })
      expect(status).toBe(201)
      return data.campaign
    },
  }
}
