import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Row {
  id: string
  group: string
  state: string
  notes: { code: string; count?: number }[]
  test: string | null
  failures: { code: string; status: number | null; method: string; path: string }[]
}

/** F12.2 (docs/06): every outside service, where it stands and its last failed calls. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    const MAIL_ENV = ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]

    const overview = async (headers: Record<string, string>) =>
      (await http.get<{ integrations: Row[] }>("/admin/integrations/overview", { headers })).data
        .integrations

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of MAIL_ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    it("lists every service the shop uses and where each stands, for the owner and admins only", async () => {
      const owner = await createAdminUser(http, getContainer())
      const ops = await createAdminUser(http, getContainer(), "operations")

      const rows = await overview(owner.headers)
      const byOps = await settle(http.get("/admin/integrations/overview", { headers: ops.headers }))
      const row = (id: string) => rows.find((each) => each.id === id)

      expect(rows.map(({ id }) => id)).toEqual([
        "paytr",
        "iyzico",
        "bank_transfer",
        "cash_on_delivery",
        "geliver",
        "aras",
        "yurtici",
        "netgsm",
        "meta",
        "ga4",
        "resend",
        "google",
        "feeds",
        "accounting",
        "redis",
      ])
      expect(row("paytr")).toMatchObject({ state: "not_set_up", test: null, failures: [] })
      expect(row("bank_transfer")).toMatchObject({ group: "payments", state: "off" })
      expect(row("resend")).toMatchObject({
        state: "connected",
        notes: [{ code: "platform_sender" }],
      })
      expect(byOps.status).toBe(403)
    })

    it("shows a provider's last failed call by its codes, nothing of what was sent", async () => {
      const owner = await createAdminUser(http, getContainer())
      const member = await createAdminUser(http, getContainer(), "admin")
      fake.failNext(401)

      await http.post("/auth/user/emailpass/reset-password", { identifier: member.email })
      const resend = await eventually(
        async () => (await overview(owner.headers)).find((each) => each.id === "resend"),
        (found) => (found?.failures.length ?? 0) > 0
      )

      expect(resend?.failures[0]).toMatchObject({ status: 401, method: "POST" })
      expect(JSON.stringify(resend)).not.toContain(member.email)
      expect(JSON.stringify(resend)).not.toContain(fake.apiKey)
    })
  },
})
