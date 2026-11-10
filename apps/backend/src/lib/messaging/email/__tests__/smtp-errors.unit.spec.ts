import { readSenderDns } from "../sender-dns"
import { smtpError, smtpFailureOf } from "../smtp-errors"

const fail = (fields: Record<string, unknown>) => Object.assign(new Error("x"), fields)

describe("an SMTP failure's meaning", () => {
  it.each([
    [{ code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 }, "auth_failed"],
    [{ code: "ETLS", command: "STARTTLS" }, "tls_failed"],
    [{ code: "ESOCKET", originalCode: "ERR_TLS_CERT_ALTNAME_INVALID" }, "tls_failed"],
    [{ code: "ESOCKET", command: "CONN", originalCode: "ECONNREFUSED" }, "connection_refused"],
    [{ code: "EDNS", originalCode: "ENOTFOUND" }, "dns_failed"],
    [{ code: "ETIMEDOUT", command: "CONN", timeoutType: "GREETING_TIMEOUT" }, "timeout"],
    // Handed over, then silence: it may have gone, so it is not sent again
    [{ code: "ETIMEDOUT", command: "DATA", timeoutType: "SOCKET_TIMEOUT" }, "outcome_unknown"],
    [{ code: "ECONNECTION", command: "DATA" }, "outcome_unknown"],
    [
      { code: "EENVELOPE", command: "RCPT TO", responseCode: 452, response: "452 4.2.2 Full" },
      "deferred",
    ],
    [
      { code: "EENVELOPE", command: "RCPT TO", response: "550 5.1.1 No such user" },
      "recipient_rejected",
    ],
    [
      { code: "EENVELOPE", command: "RCPT TO", response: "550 5.2.1 Mailbox disabled" },
      "recipient_rejected",
    ],
    // A full mailbox may empty; a relay refused is ours to fix
    [{ code: "EENVELOPE", command: "RCPT TO", response: "552 5.2.2 Mailbox full" }, "rejected"],
    [
      { code: "EENVELOPE", command: "RCPT TO", response: "554 5.7.1 Relay access denied" },
      "rejected",
    ],
    [{ code: "EENVELOPE", command: "RCPT TO", response: "550 User unknown" }, "recipient_rejected"],
    [
      { code: "EENVELOPE", command: "MAIL FROM", response: "550 5.1.0 Sender rejected" },
      "rejected",
    ],
    [
      { code: "EMESSAGE", command: "DATA", response: "550 5.1.1 Unknown user" },
      "recipient_rejected",
    ],
    [{ code: "EMESSAGE", command: "DATA", response: "554 5.7.1 Spam" }, "rejected"],
    [{ code: "EPROTOCOL" }, "failed"],
  ])("%j is %s", (fields, expected) => {
    expect(smtpFailureOf(fail(fields))).toBe(expected)
  })

  it("reads each refusal of an envelope nodemailer gathered", () => {
    const error = fail({
      code: "EENVELOPE",
      rejectedErrors: [fail({ responseCode: 550, response: "550 5.1.1 <a@b.example> unknown" })],
    })
    expect(smtpFailureOf(error)).toBe("recipient_rejected")
  })

  it("keeps the reply's numbers only, never its words", () => {
    const error = smtpError(
      fail({ code: "EENVELOPE", command: "RCPT TO", response: "550 5.1.1 <ayse@alici.example>" })
    )
    expect(error).toMatchObject({
      provider: "smtp",
      providerCode: "recipient_rejected",
      retryable: false,
      providerMessage: "550 5.1.1",
    })
    expect(JSON.stringify(error)).not.toContain("ayse")
    expect(error.cause).toBeUndefined()
  })
})

describe("the sender domain's records", () => {
  const resolver = (records: Record<string, string[][] | Error>) => ({
    resolveTxt: (name: string) => {
      const answer = records[name] ?? Object.assign(new Error("none"), { code: "ENOTFOUND" })
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
    },
  })

  it("finds SPF, DKIM under a default selector and DMARC", async () => {
    const dns = await readSenderDns(
      "bildirim@magaza.com.tr",
      resolver({
        "magaza.com.tr": [["google-site-verification=x"], ["v=spf1 ip4:203.0.113.5 ~all"]],
        "default._domainkey.magaza.com.tr": [["v=DKIM1; k=rsa; ", "p=MIIBIjAN"]],
        "_dmarc.magaza.com.tr": [["v=DMARC1; p=none"]],
      })
    )
    expect(dns).toEqual({
      domain: "magaza.com.tr",
      spf: "found",
      dkim: "found",
      dkim_selector: "default",
      dmarc: "found",
    })
  })

  it("says missing for none, unknown when DNS did not answer", async () => {
    const dns = await readSenderDns(
      "bildirim@magaza.com.tr",
      resolver({ "_dmarc.magaza.com.tr": Object.assign(new Error("x"), { code: "ESERVFAIL" }) })
    )
    expect(dns).toMatchObject({ spf: "missing", dkim: "missing", dmarc: "unknown" })
  })
})
