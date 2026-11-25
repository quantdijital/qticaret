import { describe, expect, it } from "vitest"
import type { StoreMainSections } from "@qticaret/types"
import { footerColumnsOf } from "../footer-columns"
import { footerBarOf } from "../main-sections"

const t = (key: string) => key

const footer = (more: Record<string, unknown>) =>
  ({
    footer_bar: { id: "mainfooter", type: "footer_bar", variant: "brand_columns", ...more },
  }) as unknown as StoreMainSections

describe("the brand columns footer (adr/0049 Ek 2026-11-17)", () => {
  it("reads its own settings, and the ways to pay with the networks' own marks", () => {
    expect(
      footerBarOf(
        footer({
          payment_badges: ["visa", "amex", "installments"],
          columns: { top_strip: false, about: "Kısa", ground: "stage", badge_style: "plain" },
        }),
        t
      )
    ).toEqual({
      id: "mainfooter",
      variant: "brand_columns",
      paymentBadges: [
        {
          key: "visa",
          label: "marks.visa",
          logo: { src: "/marks/visa.png", width: 208, height: 68 },
        },
        {
          key: "amex",
          label: "marks.amex",
          logo: { src: "/marks/amex.svg", width: 24, height: 24 },
        },
        { key: "installments", label: "marks.installments", logo: null },
      ],
      columns: { topStrip: false, about: "Kısa", ground: "stage", badgeStyle: "plain" },
    })
  })

  it("takes the defaults from a backend that prints none, and steps it does not know", () => {
    expect(footerBarOf(footer({}), t).columns).toEqual({
      topStrip: true,
      about: null,
      ground: "well",
      badgeStyle: "card",
    })
    expect(
      footerColumnsOf({ ground: "primary" as never, badge_style: "mono" as never, about: "   " })
    ).toEqual({ topStrip: true, about: null, ground: "well", badgeStyle: "card" })
  })

  it("brings the newsletter's column, the bare brand block and the centred line only off their defaults", () => {
    expect(
      footerColumnsOf({ news_place: "column", brand_contact: "hide", bottom_align: "center" })
    ).toMatchObject({ newsPlace: "column", brandContact: "hide", bottomAlign: "center" })
    const odd = footerColumnsOf({
      news_place: "aside" as never,
      brand_contact: "show",
      bottom_align: "spread",
    })
    expect(odd).not.toHaveProperty("newsPlace")
    expect(odd).not.toHaveProperty("brandContact")
    expect(odd).not.toHaveProperty("bottomAlign")
  })

  it("keeps the ledger's ways to pay in words, with no settings of the variant", () => {
    const ledger = footerBarOf(
      {
        footer_bar: {
          id: "mainfooter",
          type: "footer_bar",
          variant: "ledger",
          payment_badges: ["visa"],
        },
      } as unknown as StoreMainSections,
      t
    )
    expect(ledger).toEqual({
      id: "mainfooter",
      variant: "ledger",
      paymentBadges: [{ key: "visa", label: "marks.visa" }],
    })
  })
})
