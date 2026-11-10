import { setTimeout as sleep } from "node:timers/promises"
import { isProviderError } from "../../../errors"
import { createSmtpTransport } from "../smtp"
import { isSmtpHost } from "../smtp-account"
import type { SmtpAccount } from "../smtp-account"
import { createSmtpBreaker } from "../smtp-breaker"
import { smtpSettings } from "../smtp-settings"
import { resolveSmtpTarget } from "../smtp-target"
import { headerText } from "../transports"
import type { OutgoingEmail } from "../transports"
import { reply, startRawServer, startSmtpServer } from "./smtp-server"

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

const email: OutgoingEmail = {
  from: { email: "bildirim@magaza.example", name: "Atölye" },
  to: "ayse@alici.example",
  replyTo: null,
  subject: "Siparişiniz alındı",
  html: "<p>Teşekkürler</p>",
  text: "Teşekkürler",
  template: "order.placed",
  idempotencyKey: "order.placed:email:order_1",
}

const fast = { retry: { attempts: 1 }, target: { local: true } }
const options = { tenant: "shop_example", ...fast }

/** A resolver answering from a table, counting its questions. */
function resolverOf(answers: Record<string, string[]>) {
  const asked: string[] = []
  const resolver = (host: string) => {
    asked.push(host)
    const addresses = answers[host]
    return addresses
      ? Promise.resolve(
          addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))
        )
      : Promise.reject(Object.assign(new Error("none"), { code: "ENOTFOUND" }))
  }
  return { resolver, asked }
}

async function codeOf(run: Promise<unknown>): Promise<string> {
  try {
    await run
  } catch (error) {
    if (isProviderError(error)) {
      return error.providerCode
    }
    throw error
  }
  return "sent"
}

describe("the SMTP target policy (security review M1)", () => {
  it("takes fully qualified names and canonical addresses only", () => {
    for (const host of ["mail.magaza.com.tr", "localhost", "127.0.0.1", "::1", "93.184.216.34"]) {
      expect(isSmtpHost(host)).toBe(true)
    }
    for (const host of ["2130706433", "127.1", "0x0a000001", "mail", "mail.123", "intranet"]) {
      expect(isSmtpHost(host)).toBe(false)
    }
  })

  it("refuses a typed address inside a network, keeps this machine's", () => {
    const parse = (host: string, security = "tls") =>
      smtpSettings.safeParse({
        host,
        port: 465,
        security,
        from_email: "bildirim@magaza.example",
        rate_per_minute: 30,
      })
    expect(parse("10.0.0.5").error?.issues[0]?.message).toBe("smtp.host_refused")
    expect(parse("169.254.169.254").error?.issues[0]?.message).toBe("smtp.host_refused")
    expect(parse("127.0.0.1", "none").success).toBe(true)
    expect(parse("mail.magaza.example").success).toBe(true)
  })

  it("resolves the name itself and refuses it when any address is not public", async () => {
    const { resolver, asked } = resolverOf({
      "mail.magaza.example": ["93.184.216.34"],
      "ic.magaza.example": ["10.1.2.3"],
      "karisik.magaza.example": ["93.184.216.34", "127.0.0.1"],
      "metadata.magaza.example": ["169.254.169.254"],
    })
    const target = (host: string) =>
      resolveSmtpTarget({ host, port: 587, security: "starttls" }, { resolver, local: false })
    // Connected by address, the certificate read for the typed name
    expect(await target("mail.magaza.example")).toEqual({
      address: "93.184.216.34",
      servername: "mail.magaza.example",
      loopback: false,
    })
    for (const host of ["ic.magaza.example", "karisik.magaza.example", "metadata.magaza.example"]) {
      expect(await codeOf(target(host))).toBe("target_refused")
    }
    expect(await codeOf(target("yok.magaza.example"))).toBe("dns_failed")
    expect(asked).toHaveLength(5)
  })

  it("never asks DNS for this machine, and keeps it to mail ports once deployed", async () => {
    const { resolver, asked } = resolverOf({})
    const deployed = { resolver, local: false }
    expect(
      await resolveSmtpTarget({ host: "localhost", port: 25, security: "none" }, deployed)
    ).toEqual({ address: "127.0.0.1", servername: null, loopback: true })
    expect(asked).toEqual([])
    expect(
      await codeOf(resolveSmtpTarget({ host: "127.0.0.1", port: 6379, security: "none" }, deployed))
    ).toBe("port_refused")
    expect(
      await codeOf(
        resolveSmtpTarget({ host: "93.184.216.34", port: 5432, security: "tls" }, deployed)
      )
    ).toBe("port_refused")
    // Plain text leaves this machine never
    expect(
      await codeOf(
        resolveSmtpTarget({ host: "93.184.216.34", port: 25, security: "none" }, deployed)
      )
    ).toBe("tls_failed")
  })

  it("resolves again at every send, so a second answer cannot slip inside", async () => {
    const { resolver, asked } = resolverOf({ "mail.magaza.example": ["10.0.0.7"] })
    const transport = createSmtpTransport(
      account({ host: "mail.magaza.example", port: 587, security: "starttls" }),
      { tenant: "shop_example", retry: { attempts: 1 }, target: { resolver, local: false } }
    )
    expect(await codeOf(transport.send(email))).toBe("target_refused")
    expect(await codeOf(transport.verify())).toBe("target_refused")
    expect(asked).toEqual(["mail.magaza.example", "mail.magaza.example"])
  })
})

describe("the SMTP connection", () => {
  it("greets with a public name and connects to the allowed address", async () => {
    let greeted = ""
    const server = await startSmtpServer({
      onMailFrom(_address, session, callback) {
        greeted = session.hostNameAppearsAs
        callback()
      },
    })
    try {
      await createSmtpTransport(account({ port: server.port }), options).send(email)
      expect(greeted).toMatch(/\.[a-z][a-z0-9-]*$/)
      expect(greeted).not.toMatch(/127\.0\.0\.1|^\[/)
    } finally {
      await server.close()
    }
  })

  it("sends nothing once the caller gave up", async () => {
    const server = await startSmtpServer({
      onRcptTo(_address, _session, callback) {
        // The server is slow to take the recipient: the caller's wait runs out first
        setTimeout(callback, 400)
      },
    })
    try {
      const transport = createSmtpTransport(account({ port: server.port }), options)
      expect(await codeOf(transport.send(email, AbortSignal.timeout(100)))).toBe("aborted")
      await sleep(700)
      expect(server.received).toHaveLength(0)
    } finally {
      await server.close()
    }
  })

  it("suppresses on a bare 550 only from a server that gives no enhanced codes", async () => {
    const refuse = (_address: unknown, _session: unknown, callback: (error?: Error) => void) => {
      callback(reply(550, "User unknown"))
    }
    const bare = await startSmtpServer({ onRcptTo: refuse })
    // smtp-server adds the code itself once it lists ENHANCEDSTATUSCODES: a plain
    // server that lists it and still answers bare stands in for a careless relay
    const listing = await startRawServer([
      "250-mail.magaza.example",
      "250-ENHANCEDSTATUSCODES",
      "250 8BITMIME",
    ])
    try {
      expect(
        await codeOf(createSmtpTransport(account({ port: bare.port }), options).send(email))
      ).toBe("recipient_rejected")
      expect(
        await codeOf(createSmtpTransport(account({ port: listing.port }), options).send(email))
      ).toBe("rejected")
    } finally {
      await bare.close()
      await listing.close()
    }
  })
})

describe("the suppression brake (security review M2)", () => {
  it("suppresses single refusals, trips at 5 and half of the window, and undoes them", () => {
    const breaker = createSmtpBreaker()
    const at = 1_000_000
    for (let index = 0; index < 6; index += 1) {
      breaker.record("sent", at + index)
    }
    const verdicts = [0, 1, 2, 3].map((index) => {
      const verdict = breaker.record("rejected", at + 10 + index)
      breaker.noteSuppression(`msup_${String(index)}`, at + 10 + index)
      return verdict.suppress
    })
    // 4 of 10: each is the customer's own
    expect(verdicts).toEqual([true, true, true, true])
    // 5 of 11: still under half
    expect(breaker.record("rejected", at + 20)).toMatchObject({ suppress: true, tripped: false })
    // 6 of 12: the server's; it trips, hands back what the window suppressed
    expect(breaker.record("rejected", at + 21)).toMatchObject({
      suppress: false,
      tripped: true,
      rejections: 6,
      sends: 12,
      undo: ["msup_0", "msup_1", "msup_2", "msup_3"],
    })
    expect(breaker.record("rejected", at + 22)).toMatchObject({ suppress: false, tripped: false })
    expect(breaker.isOpen(at + 22)).toBe(true)
  })

  it("trips once and stays open for an hour", () => {
    const breaker = createSmtpBreaker()
    const at = 5_000_000
    const outcomes = [1, 2, 3, 4, 5].map((index) => breaker.record("rejected", at + index))
    expect(outcomes.map((each) => each.tripped)).toEqual([false, false, false, false, true])
    expect(outcomes.slice(0, 4).every((each) => each.suppress)).toBe(true)
    expect(breaker.record("rejected", at + 10).suppress).toBe(false)
    expect(breaker.isOpen(at + 59 * 60 * 1000)).toBe(true)
    expect(breaker.isOpen(at + 61 * 60 * 1000)).toBe(false)
    // An hour on, the old window is gone: a single refusal is the customer's again
    expect(breaker.record("rejected", at + 61 * 60 * 1000).suppress).toBe(true)
  })

  it("hands back the window's suppressions when it trips", () => {
    const breaker = createSmtpBreaker()
    const at = 9_000_000
    for (let index = 0; index < 4; index += 1) {
      breaker.record("rejected", at + index)
      breaker.noteSuppression(`msup_${String(index)}`, at + index)
    }
    expect(breaker.record("rejected", at + 5).undo).toEqual([
      "msup_0",
      "msup_1",
      "msup_2",
      "msup_3",
    ])
  })
})

describe("header text", () => {
  it("drops bidi and zero-width characters, keeps the emoji joiner", () => {
    expect(headerText("Atölye‮ecilA​", 100)).toBe("AtölyeecilA")
    expect(headerText("Aile 👨‍👩‍👧", 100)).toBe("Aile 👨‍👩‍👧")
  })
})
