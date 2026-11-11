import { planDocumentSchema } from "@qticaret/types/control-plane"
import { contentHash, planContent, planDocumentOf } from "../../fleet/plan-content"
import { fullLimits } from "../../plans/limits"
import {
  addDays,
  addMonthsAnchored,
  daysBetween,
  isDay,
  istanbulDay,
  istanbulHour,
  periodEnd,
} from "../days"
import { reminderEmail, turkishDate, turkishLira } from "../reminder-mail"
import {
  anyOverdue,
  billingSummary,
  chargeStanding,
  reminderKindFor,
  subscriptionStatus,
} from "../rules"
import { billingTarget } from "../tenant-moves"

describe("Istanbul calendar days (Ek C16)", () => {
  it("turns at 21:00 UTC and counts hours in UTC+3", () => {
    expect(istanbulDay(new Date("2026-11-30T20:59:59Z"))).toBe("2026-11-30")
    expect(istanbulDay(new Date("2026-11-30T21:00:00Z"))).toBe("2026-12-01")
    expect(istanbulHour(new Date("2026-12-01T05:59:00Z"))).toBe(8)
    expect(istanbulHour(new Date("2026-12-01T06:00:00Z"))).toBe(9)
  })

  it("adds days across months and years and counts between them", () => {
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08")
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28")
    expect(daysBetween("2026-11-17", "2026-12-01")).toBe(14)
    expect(daysBetween("2026-12-04", "2026-12-01")).toBe(-3)
  })

  it("renews on the anchor's day, the month's last when shorter, never drifting", () => {
    expect(addMonthsAnchored("2027-01-31", 1, 31)).toBe("2027-02-28")
    expect(addMonthsAnchored("2027-02-28", 1, 31)).toBe("2027-03-31")
    expect(addMonthsAnchored("2028-01-31", 1, 31)).toBe("2028-02-29")
    expect(periodEnd("2026-12-15", "monthly", 15)).toBe("2027-01-15")
    expect(periodEnd("2026-12-15", "yearly", 15)).toBe("2027-12-15")
    expect(periodEnd("2028-02-29", "yearly", 29)).toBe("2029-02-28")
  })

  it("knows a real day from a malformed one", () => {
    expect(isDay("2026-02-28")).toBe(true)
    expect(isDay("2026-02-30")).toBe(false)
    expect(isDay("2026-2-3")).toBe(false)
    expect(isDay("2026-02-28T00:00:00Z")).toBe(false)
  })
})

describe("a charge's standing and the subscription's state (Ek C16)", () => {
  const open = (due_on: string) => ({ status: "open" as const, due_on, amount: 149_000 })

  it("is upcoming before its day, past due through its grace, overdue after", () => {
    expect(chargeStanding("2026-12-01", 7, "2026-11-30")).toBe("upcoming")
    expect(chargeStanding("2026-12-01", 7, "2026-12-01")).toBe("past_due")
    expect(chargeStanding("2026-12-01", 7, "2026-12-08")).toBe("past_due")
    expect(chargeStanding("2026-12-01", 7, "2026-12-09")).toBe("overdue")
    expect(chargeStanding("2026-12-01", 0, "2026-12-02")).toBe("overdue")
  })

  it("trials, then is active, past due, restricted; paid charges never count", () => {
    const trial = { trial_ends_on: "2026-11-25", graceDays: 7 }

    expect(subscriptionStatus({ ...trial, charges: [open("2026-11-25")] }, "2026-11-11")).toBe(
      "trialing"
    )
    expect(subscriptionStatus({ ...trial, charges: [] }, "2026-11-25")).toBe("active")
    expect(subscriptionStatus({ ...trial, charges: [open("2026-11-25")] }, "2026-11-26")).toBe(
      "past_due"
    )
    expect(subscriptionStatus({ ...trial, charges: [open("2026-11-25")] }, "2026-12-03")).toBe(
      "restricted"
    )
    expect(
      subscriptionStatus(
        { ...trial, charges: [{ ...open("2026-11-25"), status: "paid" }] },
        "2026-12-03"
      )
    ).toBe("active")
    expect(anyOverdue([open("2026-11-25")], 7, "2026-12-02")).toBe(false)
    expect(anyOverdue([open("2026-11-25")], 7, "2026-12-03")).toBe(true)
  })

  it("restricts an active shop, frees a restricted one, never touches the others", () => {
    expect(billingTarget("active", "restricted")).toBe("restricted")
    expect(billingTarget("restricted", "active")).toBe("active")
    expect(billingTarget("restricted", "past_due")).toBe("active")
    expect(billingTarget("restricted", "restricted")).toBeNull()
    expect(billingTarget("active", "past_due")).toBeNull()
    for (const status of ["provisioning", "suspended", "closing", "closed"] as const) {
      expect(billingTarget(status, "restricted")).toBeNull()
      expect(billingTarget(status, "active")).toBeNull()
    }
  })
})

describe("the reminder schedule (adr/0061 §7, Ek C16)", () => {
  const due = "2026-12-01"
  const kindOn = (today: string) => reminderKindFor(due, 7, today)

  it("names each day's reminder, nothing before the first", () => {
    expect(kindOn("2026-11-16")).toBeNull()
    expect(kindOn("2026-11-17")).toBe("before_14")
    expect(kindOn("2026-11-23")).toBe("before_14")
    expect(kindOn("2026-11-24")).toBe("before_7")
    expect(kindOn("2026-11-28")).toBe("before_3")
    expect(kindOn("2026-11-30")).toBe("before_1")
    expect(kindOn("2026-12-01")).toBe("due")
    expect(kindOn("2026-12-03")).toBe("due")
    expect(kindOn("2026-12-04")).toBe("overdue_3")
    expect(kindOn("2026-12-08")).toBe("overdue_3")
    expect(kindOn("2026-12-09")).toBe("restricted")
  })

  it("goes to restricted before overdue_3 when the grace is shorter", () => {
    expect(reminderKindFor(due, 2, "2026-12-03")).toBe("due")
    expect(reminderKindFor(due, 2, "2026-12-04")).toBe("restricted")
  })
})

describe("the plan document's billing summary (Ek C16)", () => {
  it("shows the oldest open charge, and its grace's end while late", () => {
    const summary = billingSummary({
      status: "past_due",
      graceDays: 7,
      open: [
        { due_on: "2027-01-01", amount: 149_000 },
        { due_on: "2026-12-01", amount: 120_000 },
      ],
      next: null,
    })

    expect(summary).toEqual({
      status: "past_due",
      due_on: "2026-12-01",
      grace_ends_on: "2026-12-08",
      amount: 120_000,
      currency: "TRY",
    })
  })

  it("shows the next renewal when nothing is open, and no grace when on time", () => {
    expect(
      billingSummary({
        status: "active",
        graceDays: 7,
        open: [],
        next: { due_on: "2027-01-01", amount: 149_000 },
      })
    ).toMatchObject({ due_on: "2027-01-01", amount: 149_000, grace_ends_on: null })
    expect(
      billingSummary({
        status: "trialing",
        graceDays: 7,
        open: [{ due_on: "2026-11-25", amount: 49_000 }],
        next: null,
      }).grace_ends_on
    ).toBeNull()
  })

  it("goes into a document the contract accepts, and changes its hash", () => {
    const base = {
      tenantId: "ten_01JCP0TEST0000000000000000",
      status: "active" as const,
      packageCode: "profesyonel",
      packageLimits: fullLimits({ products: 500 }),
      packageFeatures: {},
      limitOverrides: [],
      flagOverrides: [],
      now: new Date("2026-11-11T09:00:00Z"),
      nodeEnv: "test",
    }
    const billing = {
      status: "past_due" as const,
      due_on: "2026-12-01",
      grace_ends_on: "2026-12-08",
      amount: 149_000,
      currency: "TRY" as const,
      package_name: "Profesyonel",
      payment_instruction: "Alıcı: Quant Dijital\nIBAN: TR00 0000 0000 0000 0000 0000 00",
    }
    const content = planContent({ ...base, billing })

    expect(planDocumentSchema.parse(planDocumentOf(content, 3, base.now)).billing).toEqual(billing)
    expect(contentHash(content)).not.toBe(contentHash(planContent(base)))
  })
})

describe("a reminder's e-mail (Ek C16)", () => {
  const facts = {
    kind: "before_7" as const,
    shop: "My L'arte",
    package: "Profesyonel",
    name: "Selin Aydın",
    due_on: "2026-12-01",
    period_start: "2026-12-01",
    period_end: "2027-01-01",
    amount: 149_000,
    grace_ends_on: "2026-12-08",
    today: "2026-11-24",
    instruction: "Alıcı: Quant Dijital <b>\nIBAN: TR00",
  }

  it("writes days and lira as a Turkish reader does", () => {
    expect(turkishDate("2026-12-01")).toBe("1 Aralık 2026")
    expect(turkishLira(149_000)).toBe("1.490,00 TL")
    expect(turkishLira(12_345_678)).toBe("123.456,78 TL")
    expect(turkishLira(5)).toBe("0,05 TL")
  })

  it("says the day, the days left, the amount, the period and how to pay, escaped", () => {
    const email = reminderEmail("selin@egezeytin.com.tr", facts)

    expect(email.subject).toBe("My L'arte aboneliği: ödeme günü 1 Aralık 2026")
    expect(email.text).toContain("Merhaba Selin Aydın,")
    expect(email.text).toContain("1 Aralık 2026 (7 gün sonra)")
    expect(email.text).toContain("1.490,00 TL")
    expect(email.text).toContain("1 Aralık 2026 – 31 Aralık 2026")
    expect(email.text).toContain("IBAN: TR00")
    expect(email.html).toContain("Quant Dijital &lt;b&gt;<br>IBAN")
    expect(email.html).not.toContain("<b>")
    expect(email.template).toBe("cp.billing_before_7")
    expect(`${email.subject} ${email.text}`).not.toMatch(/test|demo|deneme/i)
  })

  it("tells of the grace's end when late and of the restriction, data kept", () => {
    const late = reminderEmail("a@b.com", { ...facts, kind: "overdue_3", today: "2026-12-04" })
    const restricted = reminderEmail("a@b.com", { ...facts, kind: "restricted", name: null })

    expect(late.subject).toBe("My L'arte aboneliği: ödemeniz gecikti")
    expect(late.text).toContain("8 Aralık 2026 tarihine kadar")
    expect(restricted.text.startsWith("Merhaba,")).toBe(true)
    expect(restricted.text).toContain("Hiçbir veriniz silinmez")
    expect(reminderEmail("a@b.com", { ...facts, instruction: null }).text).not.toContain(
      "Ödeme bilgileri"
    )
  })
})
