import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { SMTPServerOptions } from "smtp-server"
import { reply, startSmtpServer } from "../../src/lib/messaging/email/__tests__/smtp-server"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { createAdminUser } from "../helpers/admin"
import { captureOutput } from "../helpers/logs"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// Throwaway, per run: the in-process server below is the only one that knows it
const PASSWORD = `pw ${randomUUID()}`
const USER = "bildirim@magaza.example"
const GONE = "olmayan@alici.example"

interface Account {
  provider: string
  state: string
  settings: Record<string, unknown> | null
  secrets: Record<string, boolean>
}

interface AuditEntry {
  action: string
  changes: { diff?: Record<string, unknown> } | null
}

const PATH = "/admin/integrations/credentials/smtp"

// Signs in only with the account's password; says a mailbox does not exist for GONE
const SERVER: Partial<SMTPServerOptions> = {
  authOptional: false,
  onAuth(auth, _session, callback) {
    if (auth.username === USER && auth.password === PASSWORD) {
      callback(null, { user: USER })
    } else {
      callback(reply(535, "5.7.8 Authentication credentials invalid"))
    }
  },
  onRcptTo(address, _session, callback) {
    callback(address.address === GONE ? reply(550, "5.1.1 Recipient address rejected") : undefined)
  },
}

/**
 * The shop's own mail server (adr/0036 Ek 2026-11-10): saved by the owner,
 * the password written once and never shown, a test e-mail to the staff
 * member's own address, a permanent "no such mailbox" on the suppression
 * list. The server is smtp-server on 127.0.0.1: nothing leaves the machine.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let server: Awaited<ReturnType<typeof startSmtpServer>>
    let owner: Awaited<ReturnType<typeof createAdminUser>>

    const settings = (port = server.port) => ({
      host: "127.0.0.1",
      port,
      security: "none",
      username: USER,
      from_email: USER,
      from_name: "Atölye",
      rate_per_minute: 20,
    })
    const save = (headers: Record<string, string>, password = PASSWORD, port = server.port) =>
      settle(
        http.post<{ account: Account; check: string | null }>(
          PATH,
          { settings: settings(port), secrets: { password } },
          { headers }
        )
      )
    const testSend = (headers: Record<string, string>) =>
      settle(http.post<Record<string, unknown>>("/admin/messaging/smtp/test", {}, { headers }))

    beforeAll(async () => {
      server = await startSmtpServer(SERVER)
    })

    afterAll(async () => {
      await server.close()
    })

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
      server.received.length = 0
    })

    it("saves the owner's server after signing in; nothing shows or records the password", async () => {
      let saved!: Awaited<ReturnType<typeof save>>
      let refused!: Awaited<ReturnType<typeof save>>
      const output = await captureOutput(async () => {
        refused = await save(owner.headers, "yanlis sifre")
        saved = await save(owner.headers)
      })

      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "smtp.secret_invalid" })
      expect(saved.status).toBe(200)
      expect(saved.data).toMatchObject({
        check: "valid",
        account: { state: "connected", settings: settings(), secrets: { password: true } },
      })
      let entries: AuditEntry[] = []
      for (let attempt = 0; attempt < 30 && entries.length === 0; attempt++) {
        entries = (
          await http.get<{ audit_entries: AuditEntry[] }>(
            "/admin/audit-log?resource_id=smtp&kind=mutation",
            { headers: owner.headers }
          )
        ).data.audit_entries
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(entries[0]).toMatchObject({
        action: "POST /admin/integrations/credentials/:provider",
        changes: {
          diff: expect.objectContaining({
            state: { before: "not_configured", after: "connected" },
          }) as unknown,
        },
      })
      const listed = await http.get("/admin/integrations/credentials", { headers: owner.headers })
      expect(JSON.stringify([saved.data, listed.data, entries])).not.toContain(PASSWORD)
      expect(output).not.toContain(PASSWORD)
      expect(server.received).toHaveLength(0)
    })

    it("refuses plain text to another machine and a port that is not a mail port", async () => {
      const post = (changes: Record<string, unknown>) =>
        settle(
          http.post(
            PATH,
            { settings: { ...settings(), ...changes }, secrets: { password: PASSWORD } },
            { headers: owner.headers }
          )
        )
      const remote = await post({ host: "mail.magaza.example" })
      expect(remote.status).toBe(400)
      expect(remote.data).toMatchObject({ message: "smtp.plain_remote" })
      const port = await post({ host: "mail.magaza.example", port: 6379, security: "tls" })
      expect(port.status).toBe(400)
      expect(port.data).toMatchObject({ message: "smtp.port_invalid" })
    })

    it("lets only the owner save it; the admin may send a test, operations neither", async () => {
      const admin = await createAdminUser(http, getContainer(), "admin")
      const operations = await createAdminUser(http, getContainer(), "operations")
      // None saved: an earlier test's account gone from the credentials' cache too
      await settle(http.delete(PATH, { headers: owner.headers }))
      expect((await save(admin.headers)).status).toBe(403)
      expect((await testSend(operations.headers)).status).toBe(403)
      const none = await testSend(admin.headers)
      expect(none.status).toBe(400)
      expect(none.data).toMatchObject({ message: "messaging.smtp_missing" })

      expect((await save(owner.headers)).status).toBe(200)
      const sent = await testSend(admin.headers)
      expect(sent.status).toBe(200)
      expect(sent.data).toEqual({
        ok: true,
        to: expect.stringContaining("@example.com") as unknown,
      })
      expect(server.received).toHaveLength(1)
      // To the caller's own sign-in address, from the shop's sender
      expect(server.received[0]?.to).toEqual([admin.email])
      expect(server.received[0]?.from).toBe(USER)
    })

    it("says why a test did not go, with the server's numbers only", async () => {
      const gone = await startSmtpServer(SERVER)
      expect((await save(owner.headers, PASSWORD, gone.port)).status).toBe(200)
      await gone.close()
      const down = await testSend(owner.headers)
      expect(down.status).toBe(200)
      expect(down.data).toEqual({ ok: false, reason: "connection_refused", reply: null })
    })

    it("tells the e-mail tab the sender and its DNS, as a warning", async () => {
      expect((await save(owner.headers)).status).toBe(200)
      const { data } = await http.get<Record<string, unknown>>("/admin/messaging/sender-domain", {
        headers: owner.headers,
      })
      expect(data).toMatchObject({
        sending: true,
        available: false,
        transport: "smtp",
        sender: USER,
        dns: { domain: "magaza.example", spf: "missing", dkim: "missing", dmarc: "missing" },
      })
    })

    it("puts a mailbox the server says does not exist on the suppression list", async () => {
      expect((await save(owner.headers)).status).toBe(200)
      const container = getContainer()
      const send = (to: string) =>
        container.resolve(Modules.NOTIFICATION).createNotifications({
          to,
          channel: "email",
          template: "order.placed",
          content: { subject: "Siparişiniz", html: "<p>Merhaba</p>", text: "Merhaba" },
          provider_data: { from_email: USER, from_name: "Atölye", reply_to: null },
          idempotency_key: `smtp-spec:${to}:${randomUUID()}`,
        })
      await expect(send(GONE)).rejects.toThrow(/recipient_rejected/)
      await send("ayse@alici.example")

      const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
      expect(await messaging.isSuppressed("email", GONE)).toBe(true)
      expect(await messaging.isSuppressed("email", "ayse@alici.example")).toBe(false)
      const [row] = await messaging.listMessageSuppressions({ channel: "email" }, { take: 5 })
      expect(row).toMatchObject({ reason: "bounce", source: "smtp", detail: "550 5.1.1" })
      expect(server.received.map((each) => each.to)).toEqual([["ayse@alici.example"]])
    })
  },
})
