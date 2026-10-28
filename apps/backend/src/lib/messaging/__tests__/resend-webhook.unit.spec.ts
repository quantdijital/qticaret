import { fakeResendSecret, signResendReport } from "@qticaret/testing"
import {
  isOwnReport,
  resendEvent,
  suppressionOf,
  verifyResendSignature,
} from "../email/resend-webhook"

describe("Resend's reports (adr/0036)", () => {
  const secret = fakeResendSecret()
  const body = JSON.stringify({ type: "email.bounced", data: { to: ["a@example.com"] } })
  const signed = (
    headers: Record<string, string>,
    overrides: Partial<{ secret: string; body: string; now: Date }> = {}
  ) =>
    verifyResendSignature({
      secret: overrides.secret ?? secret,
      id: headers["svix-id"] ?? "",
      timestamp: headers["svix-timestamp"] ?? "",
      signature: headers["svix-signature"] ?? "",
      body: overrides.body ?? body,
      ...(overrides.now ? { now: overrides.now } : {}),
    })

  it("takes a report signed with the secret, over these very bytes, within five minutes", () => {
    const headers = signResendReport(secret, body)

    expect(signed(headers)).toBe(true)
    expect(
      signed({ ...headers, "svix-signature": `v1,eHl6 ${headers["svix-signature"] ?? ""}` })
    ).toBe(true)
    expect(signed(headers, { body: `${body} ` })).toBe(false)
    expect(signed(headers, { secret: fakeResendSecret() })).toBe(false)
    expect(signed(headers, { now: new Date(Date.now() + 6 * 60 * 1000) })).toBe(false)
    expect(
      signed({
        ...headers,
        "svix-signature": (headers["svix-signature"] ?? "").replace("v1", "v2"),
      })
    ).toBe(false)
  })

  it("lists an address for a hard bounce or a complaint only", () => {
    const event = (type: string, bounce?: Record<string, string>) =>
      suppressionOf(
        resendEvent.parse({ type, data: { to: "a@example.com", ...(bounce ? { bounce } : {}) } })
      )

    expect(event("email.bounced", { type: "Permanent", subType: "General" })).toEqual({
      reason: "bounce",
      detail: "General",
    })
    expect(event("email.bounced", { type: "Transient", subType: "MailboxFull" })).toBeNull()
    expect(event("email.complained")).toEqual({ reason: "complaint", detail: null })
    expect(event("email.delivered")).toBeNull()
  })
})

describe("isOwnReport", () => {
  const report = (tags?: Record<string, string>) =>
    resendEvent.parse({
      type: "email.bounced",
      data: { to: "a@example.com", ...(tags ? { tags } : {}) },
    })

  it("takes a report about this shop's own send only", () => {
    expect(
      isOwnReport(report({ template: "order_placed", tenant: "magaza_example" }), "magaza_example")
    ).toBe(true)
    expect(isOwnReport(report({ tenant: "baska_magaza" }), "magaza_example")).toBe(false)
    expect(isOwnReport(report(), "magaza_example")).toBe(false)
  })
})
