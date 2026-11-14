import { describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"

vi.mock("@/lib/store-api/requests", () => ({
  listProducts: vi.fn(),
  pathsOf: vi.fn(),
  priceDisplays: vi.fn(),
  legalIdentity: vi.fn(),
  siteSeo: vi.fn(),
  storefrontSettings: vi.fn(),
}))
vi.mock("@/lib/store-api/extras", () => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
}))

const { sectionViews } = await import("../sections")

type Section = Parameters<typeof sectionViews>[0][number]

const faq = (look?: unknown): Section =>
  ({
    id: "sss1",
    type: "faq",
    title: null,
    items: [{ question: "Kargo?", answer: "Aynı gün." }],
    ...(look === undefined ? {} : { look }),
  }) as Section

describe("a section's look (adr/0049 Ek 2026-11-14 §6)", () => {
  it("carries the steps the shop set to the theme", async () => {
    const [view] = await sectionViews(
      [
        faq({
          space_outer: "none",
          space_inner: null,
          ground: "stage",
          align: null,
          width: null,
        }),
      ],
      t
    )

    expect(view).toMatchObject({ type: "faq", look: { space_outer: "none", ground: "stage" } })
    expect(view?.look).toEqual({ space_outer: "none", ground: "stage" })
  })

  it("leaves a section without a look, or with none set, as it was before looks", async () => {
    const [plain, unset] = await sectionViews(
      [
        faq(),
        {
          ...faq({ space_outer: null, space_inner: null, ground: null, align: null, width: null }),
          id: "sss2",
        },
      ],
      t
    )

    expect(plain).not.toHaveProperty("look")
    expect(unset).not.toHaveProperty("look")
  })

  it("reads a step a newer backend wrote as the theme's own", async () => {
    const [view] = await sectionViews([faq({ ground: "neon", width: "full" })], t)

    expect(view?.look).toEqual({ width: "full" })
  })
})
