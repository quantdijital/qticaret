import { isProviderError } from "../../../errors"
import { createSmtpTransport, messageIdOf, smtpOptions } from "../smtp"
import { isLoopbackHost, smtpAccountOf, smtpPace } from "../smtp-account"
import type { SmtpAccount } from "../smtp-account"
import type { OutgoingEmail } from "../transports"
import { reply, startSmtpServer } from "./smtp-server"

const account = (overrides: Partial<SmtpAccount> = {}): SmtpAccount => ({
  host: "127.0.0.1",
  port: 2525,
  security: "none",
  username: null,
  password: null,
  fromEmail: "bildirim@magaza.example",
  fromName: null,
  ratePerMinute: 30,
  ...overrides,
})

const email = (overrides: Partial<OutgoingEmail> = {}): OutgoingEmail => ({
  from: { email: "bildirim@magaza.example", name: "Atölye Bıçak" },
  to: "ayse@alici.example",
  replyTo: "destek@magaza.example",
  subject: "Siparişiniz alındı",
  html: "<p>Teşekkürler</p>",
  text: "Teşekkürler",
  template: "order.placed",
  idempotencyKey: "order.placed:email:order_1",
  ...overrides,
})

// Fast and quiet: no backoff, short waits
const options = { tenant: "shop_example", retry: { baseDelayMs: 0, maxDelayMs: 0 } }

async function failureOf(run: Promise<unknown>) {
  try {
    await run
  } catch (error) {
    if (isProviderError(error)) {
      return { code: error.providerCode, retryable: error.retryable, said: error.providerMessage }
    }
    throw error
  }
  throw new Error("expected a failure")
}

describe("the SMTP account", () => {
  const stored = (settings: Record<string, unknown>, secrets: Record<string, string> = {}) =>
    smtpAccountOf({
      settings: {
        host: "mail.magaza.example",
        port: 587,
        security: "starttls",
        from_email: "bildirim@magaza.example",
        ...settings,
      },
      secrets,
    })

  it("sends in the clear only to this machine", () => {
    expect(isLoopbackHost("localhost")).toBe(true)
    expect(isLoopbackHost("127.0.0.53")).toBe(true)
    expect(isLoopbackHost("::1")).toBe(true)
    expect(isLoopbackHost("172.17.0.1")).toBe(false)
    expect(isLoopbackHost("host.docker.internal")).toBe(false)
    expect(stored({ security: "none" })).toBeNull()
    expect(stored({ host: "127.0.0.1", security: "none" })?.security).toBe("none")
  })

  it("asks for the password with a login, and keeps the rate within its bounds", () => {
    expect(stored({ username: "bildirim@magaza.example" })).toBeNull()
    expect(stored({ username: "bildirim" }, { password: "gizli" })?.password).toBe("gizli")
    expect(stored({ rate_per_minute: 5000 })?.ratePerMinute).toBe(30)
    expect(smtpPace(account({ ratePerMinute: 20 }))).toEqual({ batch: 20, spacingMs: 3000 })
  })

  it("requires TLS: implicit on 465, STARTTLS otherwise, with the certificate checked", () => {
    const tls = smtpOptions(account({ host: "mail.magaza.example", port: 465, security: "tls" }))
    expect(tls).toMatchObject({ secure: true, requireTLS: false, ignoreTLS: false })
    expect(tls.tls).toEqual({ minVersion: "TLSv1.2", rejectUnauthorized: true })
    const starttls = smtpOptions(account({ host: "mail.magaza.example", security: "starttls" }))
    expect(starttls).toMatchObject({ secure: false, requireTLS: true, ignoreTLS: false })
    expect(() => smtpOptions(account({ host: "mail.magaza.example" }))).toThrow()
    expect(smtpOptions(account())).toMatchObject({
      disableFileAccess: true,
      disableUrlAccess: true,
    })
  })

  it("gives the same send the same Message-ID, another shop's another", () => {
    const id = messageIdOf("shop_a", "order.placed:email:order_1", "bildirim@magaza.example")
    expect(id).toMatch(/^<[0-9a-f]{40}@magaza\.example>$/)
    expect(messageIdOf("shop_a", "order.placed:email:order_1", "x@magaza.example")).toBe(id)
    expect(messageIdOf("shop_b", "order.placed:email:order_1", "x@magaza.example")).not.toBe(id)
    expect(id).not.toContain("order_1")
  })
})

describe("the SMTP transport", () => {
  it("sends the message with one-line headers and its Message-ID", async () => {
    const server = await startSmtpServer()
    try {
      const transport = createSmtpTransport(account({ port: server.port }), options)
      const { id } = await transport.send(
        email({
          subject: "Siparişiniz\r\nBcc: kurban@example.com",
          from: { email: "bildirim@magaza.example", name: 'Atölye "Bıçak"\nBcc: x@y.z' },
          headers: {
            "List-Unsubscribe": "<https://magaza.example/u/abc>\r\nX-Evil: 1",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })
      )
      expect(server.received).toHaveLength(1)
      const [message] = server.received
      expect(message?.to).toEqual(["ayse@alici.example"])
      expect(message?.from).toBe("bildirim@magaza.example")
      const raw = message?.raw ?? ""
      const headers = raw.slice(0, raw.indexOf("\r\n\r\n"))
      expect(headers).toContain(`Message-ID: <${id}>`)
      expect(headers).toMatch(/^Reply-To: destek@magaza\.example$/m)
      expect(headers).toMatch(/^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m)
      // What was smuggled in after a line break is text on its own header, never a header
      expect(headers).not.toMatch(/^Bcc:/im)
      expect(headers).not.toMatch(/^X-Evil:/im)
      expect(headers).toMatch(/^List-Unsubscribe: <https:\/\/magaza\.example\/u\/abc> X-Evil: 1$/m)
    } finally {
      await server.close()
    }
  })

  it("signs in, and calls a refused login auth_failed without trying again", async () => {
    let tries = 0
    const server = await startSmtpServer({
      authOptional: false,
      onAuth(auth, _session, callback) {
        tries += 1
        if (auth.username === "bildirim" && auth.password === "dogru-sifre") {
          callback(null, { user: "bildirim" })
        } else {
          callback(reply(535, "5.7.8 Authentication failed"))
        }
      },
    })
    try {
      const good = account({ port: server.port, username: "bildirim", password: "dogru-sifre" })
      await createSmtpTransport(good, options).verify()
      const bad = { ...good, password: "yanlis-sifre" }
      tries = 0
      expect(await failureOf(createSmtpTransport(bad, options).send(email()))).toEqual({
        code: "auth_failed",
        retryable: false,
        said: "535 5.7.8",
      })
      expect(tries).toBe(1)
    } finally {
      await server.close()
    }
  })

  it("calls a mailbox that does not exist recipient_rejected", async () => {
    const server = await startSmtpServer({
      onRcptTo(_address, _session, callback) {
        callback(reply(550, "5.1.1 <ayse@alici.example>: Recipient address rejected"))
      },
    })
    try {
      const failure = await failureOf(
        createSmtpTransport(account({ port: server.port }), options).send(email())
      )
      // Only the reply's numbers: its words quote the address
      expect(failure).toEqual({ code: "recipient_rejected", retryable: false, said: "550 5.1.1" })
    } finally {
      await server.close()
    }
  })

  it("does not blame the recipient for a policy refusal", async () => {
    const server = await startSmtpServer({
      onRcptTo(_address, _session, callback) {
        callback(reply(554, "5.7.1 Relay access denied"))
      },
    })
    try {
      expect(
        await failureOf(createSmtpTransport(account({ port: server.port }), options).send(email()))
      ).toMatchObject({ code: "rejected", retryable: false })
    } finally {
      await server.close()
    }
  })

  it("tries a 4xx again, then gives up as retryable", async () => {
    let tries = 0
    const server = await startSmtpServer({
      onRcptTo(_address, _session, callback) {
        tries += 1
        callback(reply(451, "4.7.1 Try again later"))
      },
    })
    try {
      expect(
        await failureOf(createSmtpTransport(account({ port: server.port }), options).send(email()))
      ).toEqual({ code: "deferred", retryable: true, said: "451 4.7.1" })
      expect(tries).toBe(3)
    } finally {
      await server.close()
    }
  })

  it("sends after a 4xx once the server takes it", async () => {
    let tries = 0
    const server = await startSmtpServer({
      onRcptTo(_address, _session, callback) {
        tries += 1
        callback(tries === 1 ? reply(450, "4.2.0 Mailbox busy") : undefined)
      },
    })
    try {
      await createSmtpTransport(account({ port: server.port }), options).send(email())
      expect(server.received).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  it("calls content refused after DATA rejected, not the recipient's fault", async () => {
    const server = await startSmtpServer({
      onData(stream, _session, callback) {
        stream.resume()
        stream.on("end", () => {
          callback(reply(554, "5.7.1 Message rejected as spam"))
        })
      },
    })
    try {
      expect(
        await failureOf(createSmtpTransport(account({ port: server.port }), options).send(email()))
      ).toMatchObject({ code: "rejected", retryable: false, said: "554 5.7.1" })
    } finally {
      await server.close()
    }
  })

  it("calls a server that is not there connection_refused, and one without TLS tls_failed", async () => {
    const server = await startSmtpServer()
    const port = server.port
    await server.close()
    expect(await failureOf(createSmtpTransport(account({ port }), options).verify())).toMatchObject(
      { code: "connection_refused", retryable: true }
    )

    // STARTTLS required where the server offers none
    const plain = await startSmtpServer()
    try {
      const starttls = account({ host: "localhost", port: plain.port, security: "starttls" })
      expect(await failureOf(createSmtpTransport(starttls, options).verify())).toMatchObject({
        code: "tls_failed",
        retryable: false,
      })
    } finally {
      await plain.close()
    }
  })

  it("refuses a certificate it cannot check", async () => {
    // smtp-server's own STARTTLS certificate is self-signed
    const server = await startSmtpServer({ disabledCommands: [] })
    try {
      const starttls = account({ host: "localhost", port: server.port, security: "starttls" })
      expect(await failureOf(createSmtpTransport(starttls, options).verify())).toMatchObject({
        code: "tls_failed",
        retryable: false,
      })
    } finally {
      await server.close()
    }
  })
})
