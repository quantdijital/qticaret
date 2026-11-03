import { exclusionOf, sortAudience } from "../audience"
import type { Candidate, RecipientFacts } from "../audience"
import { overLimit, quotaDay, trHour, withinSmsHours } from "../pause"
import { SMS_MAX_PARTS, composeSms, smsLength } from "../sms"
import { fillName, unknownCampaignDocTokens, unknownCampaignTokens } from "../tokens"
import { countsOf, emptyCounts, tallied } from "../types"
import { campaignLink } from "../utm"

const granted = { status: "granted" as const, iys_status: "sent" }
const facts = (overrides: Partial<RecipientFacts> = {}): RecipientFacts => ({
  suppressed: false,
  consent: granted,
  reachedLately: false,
  ...overrides,
})

describe("bulk message audience (adr/0050 §3)", () => {
  it("sends only to a granted consent İYS knows of, not suppressed", () => {
    expect(exclusionOf(facts(), true)).toBeNull()
    expect(exclusionOf(facts({ consent: null }), true)).toBe("no_consent")
    expect(exclusionOf(facts({ consent: { status: "revoked", iys_status: "sent" } }), true)).toBe(
      "no_consent"
    )
    expect(exclusionOf(facts({ suppressed: true }), true)).toBe("suppressed")
    expect(
      exclusionOf(facts({ consent: { status: "granted", iys_status: "pending" } }), true)
    ).toBe("iys_pending")
    expect(exclusionOf(facts({ consent: { status: "granted", iys_status: "failed" } }), true)).toBe(
      "iys_pending"
    )
    // A consent İYS itself gave needs no upload
    expect(
      exclusionOf(facts({ consent: { status: "granted", iys_status: "not_required" } }), true)
    ).toBeNull()
  })

  it("leaves out anyone another campaign reached in 24 hours, while the cap is on", () => {
    expect(exclusionOf(facts({ reachedLately: true }), true)).toBe("recent")
    expect(exclusionOf(facts({ reachedLately: true }), false)).toBeNull()
  })

  it("counts a person once, keeping their customer record over a bare consent", () => {
    const candidates: Candidate[] = [
      { hash: "a", source: "consent", source_id: "mcons_1", customer_id: null },
      { hash: "a", source: "customer", source_id: "cus_1", customer_id: "cus_1" },
      { hash: "b", source: "customer", source_id: "cus_2", customer_id: "cus_2" },
      { hash: "c", source: "customer", source_id: "cus_3", customer_id: "cus_3" },
    ]
    const sorted = sortAudience(
      candidates,
      2,
      (hash) => (hash === "c" ? facts({ suppressed: true }) : facts()),
      true
    )
    expect(sorted.audience).toBe(5)
    expect(sorted.eligible.map((each) => each.source_id)).toEqual(["cus_1", "cus_2"])
    expect(sorted.excluded).toMatchObject({ suppressed: 1, invalid_recipient: 2 })
  })
})

describe("bulk message pauses (adr/0050 §6)", () => {
  it("judges rates only after 200 sends", () => {
    expect(overLimit({ sent: 199, bounces: 100, complaints: 100 })).toBeNull()
    expect(overLimit({ sent: 1000, bounces: 0, complaints: 3 })).toBeNull()
    expect(overLimit({ sent: 1000, bounces: 0, complaints: 4 })).toBe("complaints")
    expect(overLimit({ sent: 1000, bounces: 50, complaints: 0 })).toBeNull()
    expect(overLimit({ sent: 1000, bounces: 51, complaints: 0 })).toBe("bounces")
  })

  it("counts only what came after staff resumed it", () => {
    const at = { sent: 1000, bounces: 0, complaints: 10 }
    expect(overLimit({ sent: 1100, bounces: 0, complaints: 10 }, at)).toBeNull()
    expect(overLimit({ sent: 1300, bounces: 0, complaints: 10 }, at)).toBeNull()
    expect(overLimit({ sent: 1300, bounces: 0, complaints: 11 }, at)).toBe("complaints")
  })

  it("keeps texts to their hours in Türkiye, and the quota to its UTC day", () => {
    const at = (iso: string) => new Date(iso)
    expect(trHour(at("2026-11-03T05:59:00Z"))).toBe(8)
    expect(withinSmsHours(at("2026-11-03T05:59:00Z"), 9, 20)).toBe(false)
    expect(withinSmsHours(at("2026-11-03T06:00:00Z"), 9, 20)).toBe(true)
    expect(withinSmsHours(at("2026-11-03T16:59:00Z"), 9, 20)).toBe(true)
    expect(withinSmsHours(at("2026-11-03T17:00:00Z"), 9, 20)).toBe(false)
    expect(withinSmsHours(at("2026-11-03T22:00:00Z"), 0, 24)).toBe(true)
    // 02:59 in Türkiye is still yesterday's quota; 03:00 starts the next
    expect(quotaDay(at("2026-11-03T23:59:00Z"))).toBe("2026-11-03")
    expect(quotaDay(at("2026-11-04T00:00:00Z"))).toBe("2026-11-04")
  })
})

describe("bulk SMS length (adr/0050 §4)", () => {
  it("counts GSM characters, Turkish letters as two, other scripts as UCS-2", () => {
    expect(smsLength("a".repeat(155))).toEqual({ encoding: "gsm", units: 155, parts: 1 })
    expect(smsLength("a".repeat(156)).parts).toBe(2)
    expect(smsLength("a".repeat(149 * 3)).parts).toBe(3)
    expect(smsLength("a".repeat(149 * 3 + 1)).parts).toBe(4)
    expect(smsLength("ş").units).toBe(2)
    expect(smsLength("Çöü").units).toBe(3)
    expect(smsLength("€{").units).toBe(4)
    expect(smsLength("😀 indirim")).toMatchObject({ encoding: "ucs2", parts: 1 })
    expect(smsLength("😀".repeat(36)).parts).toBe(2)
    expect(smsLength("").parts).toBe(0)
    expect(SMS_MAX_PARTS).toBe(3)
  })

  it("ends every text with the shop's name and the way to refuse", () => {
    expect(composeSms("Hafta sonu %20 indirim", "Kafe", "Ret: KAFE yaz 3838'e gönder.")).toBe(
      "Hafta sonu %20 indirim. Kafe. Ret: KAFE yaz 3838'e gönder."
    )
    expect(composeSms("İndirim!", "Kafe.", "")).toBe("İndirim! Kafe.")
  })
})

describe("bulk message tokens (adr/0050 §4)", () => {
  it("knows {ad} and the shop's details, nothing else", () => {
    expect(unknownCampaignTokens("Merhaba {ad}, {mağaza_adı} {telefon}")).toEqual([])
    expect(unknownCampaignTokens("Merhaba {isim} {ad}")).toEqual(["isim"])
    expect(
      unknownCampaignDocTokens({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "{ad} {soyad}" }] }],
      })
    ).toEqual(["soyad"])
  })

  it("puts the name in without reading tokens inside it", () => {
    expect(fillName("Merhaba {ad}, {ad}!", "Ayşe")).toBe("Merhaba Ayşe, Ayşe!")
    expect(fillName("Merhaba {ad}", "{telefon}")).toBe("Merhaba {telefon}")
  })
})

describe("bulk message links (adr/0050 §4)", () => {
  const shop = "https://magaza.example"

  it("gives the shop's own links the campaign's utm", () => {
    expect(campaignLink("/kampanya?renk=mavi", shop, "email", "kis-1a2b3c")).toBe(
      "https://magaza.example/kampanya?renk=mavi&utm_source=magaza&utm_medium=email&utm_campaign=kis-1a2b3c"
    )
    expect(campaignLink("https://www.magaza.example/x", shop, "sms", "k")).toBe(
      "https://www.magaza.example/x?utm_source=magaza&utm_medium=sms&utm_campaign=k"
    )
  })

  it("leaves another site's link alone, and drops a path while the shop has no domain", () => {
    expect(campaignLink("https://instagram.com/magaza", shop, "email", "k")).toBe(
      "https://instagram.com/magaza"
    )
    expect(campaignLink("/kampanya", null, "email", "k")).toBeNull()
  })
})

describe("bulk message counts", () => {
  it("adds the rows' reasons to what the frozen list left out", () => {
    const counts = { ...emptyCounts(), excluded: { ...emptyCounts().excluded, no_consent: 2 } }
    const result = tallied(counts, [
      { status: "sent", reason: null, count: 5 },
      { status: "pending", reason: null, count: 3 },
      { status: "skipped", reason: "no_consent", count: 1 },
      { status: "skipped", reason: "over_quota", count: 1 },
      { status: "failed", reason: "failed", count: 1 },
    ])
    expect(result).toMatchObject({ targeted: 11, sent: 5, pending: 3, failed: 1 })
    expect(result.skipped).toMatchObject({ no_consent: 3, over_quota: 1 })
  })

  it("reads an older row's counts with zeros for what it lacks", () => {
    expect(countsOf({ sent: 4 })).toMatchObject({ sent: 4, bounces: 0, review: null })
    expect(countsOf(null).skipped.recent).toBe(0)
  })
})
