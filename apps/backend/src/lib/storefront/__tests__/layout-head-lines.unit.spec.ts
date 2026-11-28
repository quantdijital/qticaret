import path from "node:path"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument, readStoredLayout } from "../layout"
import { SECTION_EYEBROW_MAX } from "../sections/head-lines"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-head-lines.ts"
)

const SOURCE = { kind: "newest" } as const
const SECTIONS: [string, Record<string, unknown>][] = [
  ["the product rail", { id: "raypopuler", type: "products", source: SOURCE }],
  [
    "the sliding product rail",
    { id: "raykayan01", type: "products", variant: "carousel", source: SOURCE },
  ],
  ["the categories", { id: "kategori01", type: "categories" }],
  ["the category panels", { id: "kategori02", type: "categories", variant: "panels" }],
  ["the departures", { id: "kalkislar1", type: "departures" }],
  ["the reviews", { id: "yorumlar01", type: "reviews" }],
  ["the sliding reviews", { id: "yorumlar02", type: "reviews", variant: "carousel" }],
  ["the posts", { id: "yazilar001", type: "posts" }],
  ["the posts' intro panel", { id: "yazilar002", type: "posts", variant: "intro_panel" }],
]

const first = (section: Record<string, unknown>) =>
  layoutDocument.parse({ home: [section] }).home[0]
const issues = (section: Record<string, unknown>) =>
  layoutDocument.safeParse({ home: [section] }).error?.issues ?? []
const at = {
  values: { mağaza_adı: "Patika" },
  images: new Map(),
  links: new Map(),
} as unknown as HydrateContext

describe("a section heading's eyebrow and hand note (head-lines.ts)", () => {
  it("is the contract's length", () => {
    const contract = jest.requireActual<{ SECTION_EYEBROW_MAX: unknown }>(CONTRACT_FILE)
    expect(SECTION_EYEBROW_MAX).toBe(contract.SECTION_EYEBROW_MAX)
    expect(SECTION_EYEBROW_MAX).toBe(60)
  })

  it.each(SECTIONS)("keeps %s's lines trimmed, none left out", (_, section) => {
    expect(
      first({ ...section, eyebrow: "  Popüler rotalar ", note: " Yol seni çağırır " })
    ).toMatchObject({
      eyebrow: "Popüler rotalar",
      note: "Yol seni çağırır",
    })
    const bare = first(section)
    expect(bare).not.toHaveProperty("note")
    if (section.variant !== "intro_panel") {
      expect(bare).not.toHaveProperty("eyebrow")
    }
  })

  it.each(SECTIONS)("refuses %s's note past its length", (_, section) => {
    expect(issues({ ...section, note: "x".repeat(61) })).not.toHaveLength(0)
  })

  it("holds the posts' eyebrow to their own 40 characters, the others' to 60", () => {
    expect(issues({ id: "yazilar001", type: "posts", eyebrow: "x".repeat(41) })).not.toHaveLength(0)
    expect(issues({ id: "kalkislar1", type: "departures", eyebrow: "x".repeat(60) })).toHaveLength(
      0
    )
    expect(
      issues({ id: "kalkislar1", type: "departures", eyebrow: "x".repeat(61) })
    ).not.toHaveLength(0)
  })

  it("reads a section stored before them as it was, with neither line", () => {
    const stored = readStoredLayout({ home: SECTIONS.map(([, section]) => section) })
    for (const section of stored.home) {
      expect(section).not.toHaveProperty("note")
    }
  })

  it.each(SECTIONS)(
    "prints %s's lines only once written, the eyebrow's shop tokens filled",
    async (_, section) => {
      const bare = await hydrateSection(first(section), at)
      expect(bare).not.toHaveProperty("note")
      if (section.variant !== "intro_panel") {
        expect(bare).not.toHaveProperty("eyebrow")
      }
      const written = await hydrateSection(
        first({ ...section, eyebrow: "{mağaza_adı} seçkisi", note: "{shop_name} sizi bekliyor" }),
        at
      )
      expect(written).toMatchObject({
        eyebrow: "Patika seçkisi",
        // The note is plain text: no token filled
        note: "{shop_name} sizi bekliyor",
      })
    }
  )
})
