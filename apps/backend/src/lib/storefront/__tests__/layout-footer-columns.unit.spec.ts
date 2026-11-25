import path from "node:path"
import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"
import {
  FOOTER_BAR_DEFAULTS,
  FOOTER_COLUMNS_DEFAULTS,
  FOOTER_COLUMNS_LIMITS,
  FOOTER_COLUMNS_SETTINGS,
} from "../sections/footer-bar"
import { SECTION_VARIANTS } from "../sections/variants"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}.ts`)
  )

const LEFT = { layout: "left", sticky: true } as const
const footer = (more: Record<string, unknown> = {}) => ({
  id: "mainfooter",
  type: "footer_bar",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the brand columns footer (adr/0049 Ek 2026-11-17)", () => {
  it("reads a footer switched to it whole, and prints all of its own settings", () => {
    const doc = withMainSections(
      layoutDocument.parse({ footer: [footer({ variant: "brand_columns" })] }),
      LEFT
    )

    expect(doc.footer[0]).toEqual({
      ...footer(),
      visible: true,
      starts_at: null,
      ends_at: null,
      variant: "brand_columns",
      ...FOOTER_BAR_DEFAULTS,
      ...FOOTER_COLUMNS_DEFAULTS,
    })
    expect(mainSectionsOf(doc).footer_bar).toEqual({
      id: "mainfooter",
      type: "footer_bar",
      variant: "brand_columns",
      columns: { top_strip: true, about: null, ground: "well", badge_style: "card" },
    })
  })

  it("keeps what the shop set, its footer's common settings beside them", () => {
    const doc = withMainSections(
      layoutDocument.parse({
        footer: [
          footer({
            variant: "brand_columns",
            social: "icons",
            payment_badges: ["visa", "mastercard", "troy"],
            top_strip: false,
            about: "  Hafta içi 16.00'ya kadar verilen sipariş aynı gün kargoda.  ",
            ground: "stage",
            badge_style: "plain",
          }),
        ],
      }),
      LEFT
    )

    expect(mainSectionsOf(doc).footer_bar).toEqual({
      id: "mainfooter",
      type: "footer_bar",
      variant: "brand_columns",
      social: "icons",
      payment_badges: ["visa", "mastercard", "troy"],
      columns: {
        top_strip: false,
        about: "Hafta içi 16.00'ya kadar verilen sipariş aynı gün kargoda.",
        ground: "stage",
        badge_style: "plain",
      },
    })
  })

  it("prints the newsletter's place, the brand's contact and the bottom line only when changed", () => {
    const doc = withMainSections(
      layoutDocument.parse({
        footer: [
          footer({
            variant: "brand_columns",
            news_place: "column",
            brand_contact: "hide",
            bottom_align: "center",
          }),
        ],
      }),
      LEFT
    )
    expect(mainSectionsOf(doc).footer_bar).toMatchObject({
      columns: { news_place: "column", brand_contact: "hide", bottom_align: "center" },
    })
    expect(
      issues({ footer: [footer({ variant: "brand_columns", news_place: "top" })] })
    ).toHaveLength(1)
  })

  it("leaves the ledger's print as it was", () => {
    const doc = withMainSections(layoutDocument.parse({ footer: [footer()] }), LEFT)
    expect(mainSectionsOf(doc).footer_bar).toEqual({
      id: "mainfooter",
      type: "footer_bar",
      variant: "ledger",
    })
  })

  it("refuses its settings on the ledger, steps off their lists and a long line", () => {
    const invalid = ["storefront_layout.section_invalid"]
    expect(issues({ footer: [footer({ ground: "stage" })] })).toHaveLength(1)
    expect(issues({ footer: [footer({ variant: "brand_columns", ground: "primary" })] })).toEqual(
      invalid
    )
    expect(issues({ footer: [footer({ variant: "brand_columns", badge_style: "mono" })] })).toEqual(
      invalid
    )
    expect(
      issues({ footer: [footer({ variant: "brand_columns", top_strip: "yes" })] })
    ).toHaveLength(1)
    const long = "a".repeat(FOOTER_COLUMNS_LIMITS.about + 1)
    expect(issues({ footer: [footer({ variant: "brand_columns", about: long })] })).toHaveLength(1)
  })

  it("reads a stored brand columns footer back as the ledger once the variant is off the list", () => {
    const stored = readStoredLayout({
      footer: [footer({ variant: "brand_columns_old", ground: "stage", social: "icons" })],
    })
    expect(stored.footer[0]).toMatchObject({ variant: "ledger", social: "icons" })
    expect(stored.footer[0]).not.toHaveProperty("ground")
  })

  it("mirrors the contract's lists and defaults", () => {
    const own = contract("section-footer")
    expect(FOOTER_COLUMNS_SETTINGS).toEqual(own["FOOTER_COLUMNS_SETTINGS"])
    expect(FOOTER_COLUMNS_LIMITS).toEqual(own["FOOTER_COLUMNS_LIMITS"])
    expect(FOOTER_COLUMNS_DEFAULTS).toEqual(own["FOOTER_COLUMNS_DEFAULTS"])
    expect(SECTION_VARIANTS.footer_bar).toEqual(["ledger", "brand_columns", "free_rows"])
  })
})
