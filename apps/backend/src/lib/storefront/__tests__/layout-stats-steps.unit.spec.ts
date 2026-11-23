import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { linksOf } from "../../../workflows/storefront/layout-check"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import type { BodySection } from "../layout"
import { STATS_DEFAULTS, STATS_LIMITS, STATS_SETTINGS, stats } from "../sections/stats"
import { STEPS_DEFAULTS, STEPS_LIMITS, STEPS_SETTINGS, steps } from "../sections/steps"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}.ts`)
  )

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const PAGE = "cnt_01KABOUT0000000000000000"
const figure = (value: string, label: string, more = {}) => ({ value, label, ...more })
const strip = (more: Record<string, unknown> = {}) => ({
  id: "rakamlar01",
  type: "stats",
  items: [figure("20 yıl", "Tecrübe"), figure("10.000+", "Mutlu müşteri")],
  ...more,
})
const step = (title: string, more = {}) => ({ title, ...more })
const howTo = (more: Record<string, unknown> = {}) => ({
  id: "adimlar01",
  type: "steps",
  items: [step("Seçin"), step("Sipariş verin"), step("Teslim alın")],
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the figures strip (adr/0077 §10)", () => {
  it("takes a new strip with its default steps, on the home page and a content page", () => {
    const doc = layoutDocument.parse({
      home: [strip()],
      pages: [{ page_id: PAGE, sections: [strip({ id: "rakamlar02" })] }],
    })

    expect(doc.home[0]).toEqual({
      ...strip(),
      ...ALWAYS,
      title: null,
      items: [
        { ...figure("20 yıl", "Tecrübe"), text: null },
        { ...figure("10.000+", "Mutlu müşteri"), text: null },
      ],
      dividers: "on",
      icons: "off",
    })
    expect(doc.pages[0]?.sections[0]).toMatchObject({ type: "stats", dividers: "on" })
  })

  it("holds two to six figures and each part to its length", () => {
    const many = Array.from({ length: STATS_LIMITS.items.max + 1 }, (_, at) =>
      figure(String(at), "Etiket")
    )
    expect(issues({ home: [strip({ items: [figure("1", "Tek")] })] })).not.toEqual([])
    expect(issues({ home: [strip({ items: many })] })).not.toEqual([])
    expect(issues({ home: [strip({ items: many.slice(0, 6) })] })).toEqual([])
    expect(
      issues({ home: [strip({ items: [figure("x".repeat(17), "Uzun"), figure("2", "İki")] })] })
    ).not.toEqual([])
    expect(
      issues({ home: [strip({ items: [figure("", "Boş"), figure("2", "İki")] })] })
    ).not.toEqual([])
  })

  it("trims the words, refuses a stray field, a step off its list, an unknown detail", () => {
    const doc = layoutDocument.parse({
      home: [strip({ items: [figure("  50+ ", " Şehir "), figure("2", "İki")] })],
    })
    expect(doc.home[0]).toMatchObject({ items: [{ value: "50+", label: "Şehir" }, {}] })
    expect(issues({ home: [strip({ dividers: "thick" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(
      issues({ home: [strip({ items: [figure("1", "a", { icon: "x" }), figure("2", "b")] })] })
    ).not.toEqual([])
    expect(
      issues({ home: [strip({ items: [figure("1", "{yok}"), figure("2", "b")] })] })
    ).toContain("storefront_layout.token_unknown")
  })

  it("is not offered on a product or a category page", () => {
    expect(issues({ product: [strip()] })).toContain("storefront_layout.section_invalid")
    expect(issues({ category: [strip({ placement: "top" })] })).toContain(
      "storefront_layout.section_invalid"
    )
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const own = contract("section-stats")
    expect(STATS_SETTINGS).toEqual(own["STATS_SETTINGS"])
    expect(STATS_DEFAULTS).toEqual(own["STATS_DEFAULTS"])
    expect(STATS_LIMITS).toEqual(own["STATS_LIMITS"])
  })
})

describe("the numbered steps (adr/0077 §10)", () => {
  it("takes new steps with their default steps, a link only when given", () => {
    const doc = layoutDocument.parse({ home: [howTo()] })

    expect(doc.home[0]).toEqual({
      ...howTo(),
      ...ALWAYS,
      title: null,
      intro: null,
      items: [
        { title: "Seçin", text: null },
        { title: "Sipariş verin", text: null },
        { title: "Teslim alın", text: null },
      ],
      link: null,
      layout: "row",
      numbers: "padded",
    })
  })

  it("holds three to six steps and refuses a step off its list", () => {
    const six = Array.from({ length: STEPS_LIMITS.items.max }, (_, at) =>
      step(`Adım ${String(at)}`)
    )
    expect(issues({ home: [howTo({ items: six.slice(0, 2) })] })).not.toEqual([])
    expect(issues({ home: [howTo({ items: [...six, step("Fazla")] })] })).not.toEqual([])
    expect(issues({ home: [howTo({ items: six })] })).toEqual([])
    expect(issues({ home: [howTo({ layout: "grid" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [howTo({ numbers: "roman" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [howTo({ intro: "x".repeat(STEPS_LIMITS.intro + 1) })] })).not.toEqual([])
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const own = contract("section-steps")
    expect(STEPS_SETTINGS).toEqual(own["STEPS_SETTINGS"])
    expect(STEPS_DEFAULTS).toEqual(own["STEPS_DEFAULTS"])
    expect(STEPS_LIMITS).toEqual(own["STEPS_LIMITS"])
  })
})

describe("the figures strip and the steps on the storefront", () => {
  const container = {} as MedusaContainer
  const values = {
    mağaza_adı: "Atölye",
    telefon: null,
    e_posta: null,
    adres: null,
    whatsapp: null,
    ücretsiz_kargo_eşiği: null,
  }
  const shop = { kind: "system", target: "shop", label: "Alışverişe başla" } as const
  const placed = { ...shop, path: null }
  const context = (links = new Map<unknown, unknown>()) =>
    ({ values, images: new Map(), links, container }) as unknown as HydrateContext

  it("names the steps' one link, the strip none", () => {
    expect(linksOf(steps.parse(howTo({ link: shop })) as BodySection)).toEqual([shop])
    expect(linksOf(steps.parse(howTo()) as BodySection)).toEqual([])
    expect(linksOf(stats.parse(strip()) as BodySection)).toEqual([])
  })

  it("prints the strip's figures with the shop's details filled and its steps", async () => {
    const section = stats.parse(
      strip({
        title: "Rakamlarla",
        items: [figure("20 yıl", "{mağaza_adı} ile"), figure("50+", "Şehir", { text: "Her gün" })],
        dividers: "off",
        look: { ground: "stage" },
      })
    )
    const shown = await hydrateSection(section, context())

    expect(shown).toEqual({
      id: "rakamlar01",
      type: "stats",
      title: "Rakamlarla",
      items: [
        { value: "20 yıl", label: "Atölye ile", text: null },
        { value: "50+", label: "Şehir", text: "Her gün" },
      ],
      dividers: "off",
      icons: "off",
      look: {
        space_outer: null,
        space_below: null,
        space_inner: null,
        ground: "stage",
        align: null,
        width: null,
      },
    })
  })

  it("prints the steps with their link placed, a broken one null", async () => {
    const section = steps.parse(
      howTo({ title: "Nasıl çalışır", intro: "{mağaza_adı} ile üç adım", link: shop })
    ) as BodySection & { link: unknown }
    const shown = await hydrateSection(section, context(new Map([[section.link, placed]])))
    const broken = await hydrateSection(section, context())

    expect(shown).toMatchObject({
      type: "steps",
      title: "Nasıl çalışır",
      intro: "Atölye ile üç adım",
      items: [
        { title: "Seçin", text: null },
        { title: "Sipariş verin", text: null },
        { title: "Teslim alın", text: null },
      ],
      link: placed,
      layout: "row",
      numbers: "padded",
    })
    expect(broken).toMatchObject({ link: null })
  })
})
