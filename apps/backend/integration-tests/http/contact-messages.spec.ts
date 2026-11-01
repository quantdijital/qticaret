import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { CONTACT_MESSAGES_MODULE } from "../../src/modules/contact-messages"
import type ContactMessagesModuleService from "../../src/modules/contact-messages/service"
import { contactMessagesFor, eraseContactMessages } from "../../src/workflows/contact/customer-data"
import { createAdminUser } from "../helpers/admin"
import { solved } from "../helpers/challenge"
import type { GivenChallenge } from "../helpers/challenge"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Listed {
  id: string
  name: string
  email: string
  phone: string | null
  body: string
  subject: string
  order_number: string | null
  customer_id: string | null
  status: string
}

/** F18 D10 (adr/0047): the storefront's contact form, kept sealed, answered from the panel. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let storefront: Storefront
    let owner: { headers: Record<string, string> }

    const send = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
      settle(
        http.post<{ status?: string; message?: string; challenge?: GivenChallenge }>(
          "/store/contact-messages",
          body,
          { headers: { ...storefront.headers, ...headers } }
        )
      )
    const list = (status: "new" | "handled", headers = owner.headers) =>
      settle(
        http.get<{ contact_messages: Listed[]; count: number }>(
          `/admin/contact-messages?status=${status}`,
          { headers }
        )
      )
    const message = (email: string) => ({
      name: "Ayşe Yılmaz",
      email,
      phone: "0532 123 45 67",
      subject: "order",
      order_number: "#1042",
      body: "Siparişim ne zaman kargoya verilir? Teşekkürler.",
    })

    const relaxed = process.env["RATE_LIMIT_RELAXED"]
    afterEach(() => {
      if (relaxed === undefined) {
        delete process.env["RATE_LIMIT_RELAXED"]
      } else {
        process.env["RATE_LIMIT_RELAXED"] = relaxed
      }
    })

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      storefront = await createStorefront(container)
      owner = await createAdminUser(http, container)
      await http.post(
        "/admin/platform-settings/notifications",
        { staff_emails: ["sahip@magaza.example"] },
        { headers: owner.headers }
      )
      fake.messages.length = 0
    })

    it("keeps a guest's message sealed, rings the bell, mails the staff and opens it for the panel", async () => {
      const email = `iletisim-${String(Date.now())}@example.com`
      const sent = await send(message(email))
      expect([sent.status, sent.data.status]).toEqual([202, "received"])

      const { data } = await list("new")
      const mine = data.contact_messages.find((row) => row.email === email)
      expect(mine).toMatchObject({
        name: "Ayşe Yılmaz",
        phone: "+905321234567",
        subject: "order",
        order_number: "1042",
        customer_id: null,
        status: "new",
      })
      // At rest nothing of the person reads in plain text
      const [row] = await getContainer()
        .resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
        .listContactMessages({ id: mine?.id ?? "" }, { take: 1 })
      expect(row?.sealed).not.toContain(email)
      expect(row?.sealed).not.toContain("Siparişim")

      const mailsToStaff = () =>
        fake.messages.filter(({ to }) => to.includes("sahip@magaza.example"))
      await eventually(
        () => Promise.resolve(mailsToStaff()),
        (mails) => mails.length > 0
      )
      const bell = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed", resource_id: mine?.id ?? "" })
      expect(bell[0]?.data).toMatchObject({ kind: "contact_message", subject: "order" })
      expect(mailsToStaff().map(({ template }) => template)).toEqual(["staff.contact_message"])
      // The message itself stays in the panel
      expect(JSON.stringify(mailsToStaff()[0])).not.toContain("Siparişim")
    })

    it("refuses what it cannot take", async () => {
      const email = `hatali-${String(Date.now())}@example.com`
      const bad = [
        { ...message(email), phone: "12" },
        { ...message(email), body: "kısa" },
        { ...message(email), subject: "kampanya" },
        { ...message(email), order_number: "ABC" },
        { ...message(email), extra: "x" },
        { ...message("adres-degil"), body: "Uzun ve geçerli bir mesaj metni." },
      ]
      for (const body of bad) {
        expect((await send(body)).status).toBe(400)
      }
    })

    it("asks a proof of work past the first message an hour from one address", async () => {
      // Per-address limits at their real size here (integration tests grow them)
      process.env["RATE_LIMIT_RELAXED"] = "0"
      const email = `ispat-${String(Date.now())}@example.com`
      let asked = await send(message(email))
      if (asked.status === 202) {
        asked = await send(message(email))
      }
      expect([asked.status, asked.data.message]).toEqual([428, "fraud.challenge_required"])
      expect((await send(message(email), solved(asked.data.challenge))).status).toBe(202)
    })

    it("lets the team mark one answered, operations too but not read-only, and the admin delete it", async () => {
      const email = `ekip-${String(Date.now())}@example.com`
      await send(message(email))
      const id = (await list("new")).data.contact_messages.find((row) => row.email === email)?.id
      expect(id).toBeDefined()
      const container = getContainer()
      const operations = await createAdminUser(http, container, "operations")
      const readonly = await createAdminUser(http, container, "readonly")
      const mark = (headers: Record<string, string>, status = "handled") =>
        settle(http.post(`/admin/contact-messages/${id ?? ""}`, { status }, { headers }))

      expect((await mark(readonly.headers)).status).toBe(403)
      expect((await mark(operations.headers)).status).toBe(200)
      expect((await list("handled")).data.contact_messages.map((row) => row.id)).toContain(id)
      expect((await list("new", readonly.headers)).status).toBe(200)

      const remove = (headers: Record<string, string>) =>
        settle(http.delete(`/admin/contact-messages/${id ?? ""}`, { headers }))
      expect((await remove(operations.headers)).status).toBe(403)
      expect((await remove(owner.headers)).status).toBe(200)
      expect((await list("handled")).data.contact_messages.map((row) => row.id)).not.toContain(id)
      expect((await mark(owner.headers)).status).toBe(404)
    })

    it("ties a signed-in customer's message to them, hands it over and erases it for KVKK", async () => {
      const customer = await registerCustomer(http, storefront)
      const guestEmail = `onceki-${String(Date.now())}@example.com`
      // Before the account: a guest message from the same address
      await send(message(customer.email))
      await send(message(guestEmail), customer.headers)

      const container = getContainer()
      const copy = await contactMessagesFor(container, customer.id, [customer.email])
      expect(copy).toHaveLength(2)
      expect(copy.map((row) => row.email).sort()).toEqual([customer.email, guestEmail].sort())

      expect(await eraseContactMessages(container, customer.id, [customer.email])).toBe(2)
      expect(await contactMessagesFor(container, customer.id, [customer.email])).toEqual([])
    })
  },
})
