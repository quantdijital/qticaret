import { randomBytes } from "node:crypto"
import { kurus } from "../../money"
import { shareText, validityText, whatsappNumber, whatsappUrl } from "../share"
import {
  cartDifference,
  completesNow,
  discountAmount,
  discountProblem,
  extendedEnd,
  isOpen,
  linesTotal,
  linkEnd,
  movedPrices,
} from "../snapshot"
import type { PaymentLinkLine } from "../snapshot"
import {
  MAX_LINK_HOURS,
  PAYMENT_LINK_TOKEN_SHAPE,
  newPaymentLinkToken,
  paymentLinkTokenHash,
  paymentLinkTokenValid,
  paymentLinkUrl,
} from "../token"

const HOUR = 60 * 60 * 1000
const key = randomBytes(32)
const now = new Date("2026-11-03T10:00:00Z")

const line = (variant: string, quantity: number, price: number): PaymentLinkLine => ({
  variant_id: variant,
  product_id: `prod_${variant}`,
  quantity,
  title: "Şef bıçağı",
  variant_title: "20 cm",
  thumbnail: null,
  unit_price: price,
})

describe("payment link token (adr/0051 §3)", () => {
  it("is pl_ with random, its end and a MAC, and opens only with our key before its end", () => {
    const { token, ends_at } = newPaymentLinkToken(key, now)
    expect(token).toMatch(PAYMENT_LINK_TOKEN_SHAPE)
    expect(ends_at.getTime() - now.getTime()).toBeLessThanOrEqual(MAX_LINK_HOURS * HOUR)
    expect(paymentLinkTokenValid(key, token, now)).toBe(true)
    expect(paymentLinkTokenValid(randomBytes(32), token, now)).toBe(false)
    expect(paymentLinkTokenValid(key, token, new Date(ends_at.getTime() + 1000))).toBe(false)
  })

  it("is never the same twice, and a changed character breaks it", () => {
    const first = newPaymentLinkToken(key, now).token
    const second = newPaymentLinkToken(key, now).token
    expect(first).not.toBe(second)
    const forged = `pl_${"A".repeat(22)}${first.slice(25)}`
    expect(paymentLinkTokenValid(key, forged, now)).toBe(false)
    expect(paymentLinkTokenValid(key, "pl_kisa.abc.def", now)).toBe(false)
  })

  it("is found by its SHA-256, and opens on the storefront's /ode page", () => {
    const { token } = newPaymentLinkToken(key, now)
    expect(paymentLinkTokenHash(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(paymentLinkTokenHash(token)).not.toContain(token)
    expect(paymentLinkUrl("https://magaza.example", token)).toBe(
      `https://magaza.example/ode/${token}`
    )
  })
})

describe("payment link snapshot (adr/0051 §2)", () => {
  const lines = [line("a", 2, 15_000), line("b", 1, 9_990)]

  it("adds the lines up in kuruş", () => {
    expect(linesTotal(lines)).toBe(39_990)
  })

  it("works out a discount, never more than the lines", () => {
    expect(discountAmount("percentage", 10, kurus(39_990))).toBe(3_999)
    expect(discountAmount("fixed", 5_000, kurus(39_990))).toBe(5_000)
    expect(discountAmount("fixed", 50_000, kurus(39_990))).toBe(39_990)
  })

  it("lets operations give none, admin up to the shop's limit, the owner just below the whole", () => {
    const total = kurus(10_000)
    const check = (role: string, discount: { type: "percentage" | "fixed"; value: number }) =>
      discountProblem(role, discount, total, 20)
    expect(check("operations", { type: "percentage", value: 5 })).toBe(
      "payment_link.discount_not_allowed"
    )
    expect(check("readonly", { type: "fixed", value: 100 })).toBe(
      "payment_link.discount_not_allowed"
    )
    expect(check("admin", { type: "percentage", value: 20 })).toBeNull()
    expect(check("admin", { type: "percentage", value: 21 })).toBe(
      "payment_link.discount_over_limit"
    )
    expect(check("admin", { type: "fixed", value: 2_001 })).toBe("payment_link.discount_over_limit")
    expect(check("owner", { type: "percentage", value: 60 })).toBeNull()
    expect(check("owner", { type: "fixed", value: 10_000 })).toBe("payment_link.discount_invalid")
  })

  it("holds an admin to the limit the owner set, and the owner to 99 whatever it is", () => {
    const total = kurus(10_000)
    const percent = (role: string, value: number, limit: number) =>
      discountProblem(role, { type: "percentage", value }, total, limit)
    expect(percent("admin", 35, 40)).toBeNull()
    expect(percent("admin", 5, 0)).toBe("payment_link.discount_over_limit")
    expect(percent("admin", 99, 99)).toBeNull()
    expect(percent("owner", 99, 0)).toBeNull()
  })

  it("finds the lines whose price moved, a variant gone among them", () => {
    expect(
      movedPrices(
        lines,
        new Map([
          ["a", 15_000],
          ["b", 9_990],
        ])
      )
    ).toEqual([])
    expect(
      movedPrices(
        lines,
        new Map([
          ["a", 15_500],
          ["b", 9_990],
        ])
      )
    ).toEqual(["a"])
    expect(movedPrices(lines, new Map([["a", 15_000]]))).toEqual(["b"])
    expect(
      movedPrices(
        lines,
        new Map<string, number | null>([
          ["a", 15_000],
          ["b", null],
        ])
      )
    ).toEqual(["b"])
  })

  it("tells a cart changed from one priced otherwise", () => {
    const b = { variant_id: "b", quantity: 1, unit_price: 9_990 }
    const a = { variant_id: "a", quantity: 2, unit_price: 15_000 }
    expect(cartDifference(lines, [b, a])).toBeNull()
    expect(cartDifference(lines, [b, a, { variant_id: "c", quantity: 1, unit_price: 1 }])).toBe(
      "changed"
    )
    expect(cartDifference(lines, [{ ...a, quantity: 3 }, b])).toBe("changed")
    expect(cartDifference(lines, [a])).toBe("changed")
    expect(cartDifference(lines, [{ ...b, unit_price: 10_990 }, a])).toBe("prices")
    expect(cartDifference(lines, [{ variant_id: null, quantity: 1, unit_price: 1 }])).toBe(
      "changed"
    )
  })
})

describe("payment link lifetime (adr/0051 §3, §12)", () => {
  it("opens while open and before its end; a payment under way completes an hour past it", () => {
    const end = new Date(now.getTime() + HOUR)
    expect(isOpen({ status: "open", expires_at: end }, now)).toBe(true)
    expect(isOpen({ status: "draft", expires_at: end }, now)).toBe(false)
    expect(isOpen({ status: "open", expires_at: now }, now)).toBe(false)
    const late = new Date(end.getTime() + 30 * 60 * 1000)
    expect(isOpen({ status: "open", expires_at: end }, late)).toBe(false)
    expect(completesNow({ status: "open", expires_at: end }, late)).toBe(true)
    expect(
      completesNow({ status: "open", expires_at: end }, new Date(end.getTime() + 2 * HOUR))
    ).toBe(false)
    expect(completesNow({ status: "canceled", expires_at: end }, now)).toBe(false)
  })

  it("ends between an hour and seven days from now", () => {
    expect(linkEnd(72, now).getTime() - now.getTime()).toBe(72 * HOUR)
    expect(linkEnd(0, now).getTime() - now.getTime()).toBe(HOUR)
    expect(linkEnd(1000, now).getTime() - now.getTime()).toBe(MAX_LINK_HOURS * HOUR)
  })

  it("extends up to the token's own end, and no further", () => {
    const link = {
      expires_at: new Date(now.getTime() + 72 * HOUR),
      token_ends_at: new Date(now.getTime() + MAX_LINK_HOURS * HOUR),
    }
    expect(extendedEnd(link, 120, now)?.getTime()).toBe(now.getTime() + 120 * HOUR)
    expect(extendedEnd(link, 168, now)?.getTime()).toBe(link.token_ends_at.getTime())
    expect(extendedEnd(link, 24, now)).toBeNull()
    expect(extendedEnd({ ...link, expires_at: link.token_ends_at }, 168, now)).toBeNull()
  })
})

describe("payment link share texts (adr/0051 §7)", () => {
  const url = "https://magaza.example/ode/pl_x"

  it("names the shop, the total, how long and the link, and no one", () => {
    const text = shareText({
      shopName: "Örnek Bıçak",
      total: 44_990,
      expiresAt: new Date(now.getTime() + 72 * HOUR),
      url,
      now,
    })
    expect(text).toBe(
      "Örnek Bıçak: Siparişiniz hazır, toplam ₺449,90. Ödeme bağlantısı (3 gün geçerli): https://magaza.example/ode/pl_x"
    )
    expect(validityText(new Date(now.getTime() + 5 * HOUR), now)).toBe("5 saat")
  })

  it("opens WhatsApp on a Turkish mobile, or without one for staff to pick the chat", () => {
    expect(whatsappNumber("0532 123 45 67")).toBe("905321234567")
    expect(whatsappNumber("+90 532 123 45 67")).toBe("905321234567")
    expect(whatsappNumber("0212 123 45 67")).toBeNull()
    expect(whatsappUrl("Merhaba & hoş geldiniz", "05321234567")).toBe(
      "https://wa.me/905321234567?text=Merhaba+%26+ho%C5%9F+geldiniz"
    )
    expect(whatsappUrl("Merhaba", null)).toBe("https://wa.me/?text=Merhaba")
  })
})
