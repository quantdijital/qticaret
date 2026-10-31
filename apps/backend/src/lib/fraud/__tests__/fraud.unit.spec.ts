import { randomBytes } from "node:crypto"
import { createMemoryStore } from "../../security/rate-limit"
import { blockEntryOf, matchesOf } from "../block"
import { isDisposableEmail } from "../disposable"
import { scoreOrder } from "../score"
import type { OrderFacts } from "../score"
import { countCheckout } from "../velocity"

// A throwaway key for these checks only
const KEY = randomBytes(32)

describe("block entries", () => {
  it("keeps an e-mail and a phone as a keyed hash, shown masked", () => {
    const email = blockEntryOf("email", " Ayse.Kaya@Example.com ", KEY)
    const phone = blockEntryOf("phone", "0532 111 22 33", KEY)

    expect(email).toMatchObject({ kind: "email", display: "ay***@example.com" })
    expect(email?.match).toMatch(/^[0-9a-f]{64}$/)
    expect(email?.match).toBe(blockEntryOf("email", "ayse.kaya@example.com", KEY)?.match)
    expect(phone).toMatchObject({ kind: "phone", display: "+905*** *** ** 33" })
    expect(phone?.match).toBe(blockEntryOf("phone", "+90 532 111 2233", KEY)?.match)
  })

  it("keeps a domain and an address as written, and refuses what is none of its kind", () => {
    expect(blockEntryOf("email_domain", "x@Mailinator.com", KEY)).toEqual({
      kind: "email_domain",
      match: "mailinator.com",
      display: "mailinator.com",
    })
    expect(blockEntryOf("ip", "2001:DB8::1", KEY)?.match).toBe("2001:db8::1")
    expect(blockEntryOf("ip", "999.1.1.1", KEY)).toBeNull()
    expect(blockEntryOf("email", "yok", KEY)).toBeNull()
    expect(blockEntryOf("email_domain", "localhost", KEY)).toBeNull()
  })

  it("lists every entry a request could match", () => {
    const kinds = matchesOf({ email: "a@b.com", phone: "05321112233", ip: "10.0.0.1" }, KEY).map(
      (entry) => entry.kind
    )
    expect(kinds).toEqual(["email", "email_domain", "phone", "ip"])
    expect(matchesOf({}, KEY)).toEqual([])
  })
})

describe("checkout velocity", () => {
  it("asks for a challenge past the soft limit and stops past the hard one", async () => {
    const store = createMemoryStore(() => 0)
    const verdicts: string[] = []
    for (let n = 0; n < 31; n++) {
      verdicts.push(
        (await countCheckout(store, { ipBucket: "ip1", emailKey: null, phoneKey: null })).verdict
      )
    }
    expect(verdicts.slice(0, 5).every((one) => one === "ok")).toBe(true)
    expect(verdicts[5]).toBe("challenge")
    expect(verdicts[29]).toBe("challenge")
    expect(verdicts[30]).toBe("block")
  })

  it("grows every limit by the test scale", async () => {
    const store = createMemoryStore(() => 0)
    const verdicts: string[] = []
    for (let n = 0; n < 11; n++) {
      const input = { ipBucket: "ip3", emailKey: "e", phoneKey: null }
      verdicts.push((await countCheckout(store, input, undefined, 100)).verdict)
    }
    expect(verdicts.every((one) => one === "ok")).toBe(true)
  })

  it("counts the e-mails an address and a phone use once each", async () => {
    const store = createMemoryStore(() => 0)
    const run = (email: string) =>
      countCheckout(store, { ipBucket: "ip2", emailKey: email, phoneKey: "tel" })
    await run("e1")
    await run("e1")
    await run("e2")
    const third = await run("e3")
    const again = await run("e3")

    expect(third).toMatchObject({ ipEmails: 3, phoneEmails: 3, verdict: "ok" })
    expect(again).toMatchObject({ ipEmails: 3, phoneEmails: 3 })
    expect((await run("e4")).verdict).toBe("challenge")
  })
})

describe("order score", () => {
  const facts: OrderFacts = {
    firstOrder: false,
    total: 10_000,
    highAmount: 500_000,
    shippingProvince: "İstanbul",
    billingProvince: "istanbul",
    ipEmails: 1,
    phoneEmails: 1,
    disposableEmail: false,
    failedPayments: 0,
  }

  it("scores nothing for an ordinary order, Turkish case aside", () => {
    expect(scoreOrder(facts)).toEqual({ score: 0, reasons: [] })
  })

  it("adds each rule that holds", () => {
    const scored = scoreOrder({
      ...facts,
      firstOrder: true,
      total: 600_000,
      billingProvince: "Ankara",
      ipEmails: 5,
      disposableEmail: true,
    })
    expect(scored.score).toBe(80)
    expect(scored.reasons.map((reason) => reason.rule)).toEqual([
      "new_customer_high_amount",
      "address_mismatch",
      "ip_many_emails",
      "disposable_email",
    ])
  })

  it("knows a throwaway mailbox", () => {
    expect(isDisposableEmail("x@YOPMAIL.com")).toBe(true)
    expect(isDisposableEmail("x@gmail.com")).toBe(false)
  })
})
