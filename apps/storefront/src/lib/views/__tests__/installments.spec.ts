import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { methodViews } from "../checkout"
import { installmentFamilies, installmentSummary } from "../installments"
import type { InstallmentTable } from "../installments"

/**
 * A price's installments (owner 2026-11-05): one line under the price
 * and the table its dialog opens, from the same Store answer; at the
 * checkout only a line saying where the bank's table shows.
 */

const option = (count: number, rate: number, total: string, perInstallment: string) => ({
  count,
  rate,
  total,
  per_installment: perInstallment,
})

const table = (over: Partial<InstallmentTable> = {}): InstallmentTable => ({
  enabled: true,
  max_count: 12,
  families: [
    {
      family: "world",
      options: [
        option(1, 0, "1968.75", "1968.75"),
        option(3, 0, "1968.75", "656.25"),
        option(12, 19.39, "2350.49", "195.87"),
      ],
    },
    {
      family: "bonus",
      options: [
        option(1, 0, "1968.75", "1968.75"),
        option(6, 10.23, "2170.15", "361.69"),
        option(12, 19.65, "2355.61", "196.30"),
      ],
    },
    // A program with one payment only offers nothing
    { family: "paraf", options: [option(1, 0, "1968.75", "1968.75")] },
  ],
  ...over,
})

describe("installmentSummary", () => {
  it("says the most installments any program offers and the lowest monthly amount at that count", () => {
    expect(installmentSummary(table())).toEqual({ count: 12, perInstallment: "195,87 TL" })
  })

  it("takes the count from the program that offers the most", () => {
    const short = table({
      families: [
        {
          family: "axess",
          options: [option(1, 0, "120.00", "120.00"), option(2, 3.59, "124.31", "62.16")],
        },
        {
          family: "bonus",
          options: [option(1, 0, "120.00", "120.00"), option(6, 8.29, "129.95", "21.66")],
        },
      ],
    })
    expect(installmentSummary(short)).toEqual({ count: 6, perInstallment: "21,66 TL" })
  })

  it("says nothing while the shop has them off or no program goes past one payment", () => {
    expect(installmentSummary(table({ enabled: false }))).toBeNull()
    expect(
      installmentSummary(
        table({ families: [{ family: "world", options: [option(1, 0, "90.00", "90.00")] }] })
      )
    ).toBeNull()
  })
})

describe("installmentFamilies", () => {
  it("writes each program as on its cards, every amount in words, a count without surcharge marked", () => {
    const families = installmentFamilies(table())
    expect(families?.map((family) => family.family)).toEqual(["World", "Bonus"])
    expect(families?.[0]?.options).toEqual([
      { count: 1, perInstallment: "1.968,75 TL", total: "1.968,75 TL" },
      { count: 3, perInstallment: "656,25 TL", total: "1.968,75 TL", free: true },
      { count: 12, perInstallment: "195,87 TL", total: "2.350,49 TL" },
    ])
  })

  it("is null while the shop offers none", () => {
    expect(installmentFamilies(table({ enabled: false }))).toBeNull()
    expect(installmentFamilies(table({ families: [] }))).toBeNull()
  })
})

describe("methodViews: the card at the checkout", () => {
  const methods = {
    card_providers: ["pp_paytr_paytr"],
    card_providers_down: [],
    bank_transfer: null,
    cash_on_delivery: null,
  }

  it("draws no table: one quiet line says the bank's installments show once the card is in", () => {
    const [card] = methodViews(methods, 12, t)
    expect(card).toMatchObject({
      kind: "card",
      detail: "Peşin ya da 12 aya varan taksit",
      note: "Taksit seçenekleri kart bilgilerinizi girince görünür.",
    })
  })

  it("says nothing more for one payment", () => {
    const [card] = methodViews(methods, 1, t)
    expect(card?.detail).toBe(t("checkout.pay_card_single"))
    expect(card?.note).toBeNull()
  })
})
