import path from "node:path"
import { headerLinked, linksOf } from "../../../workflows/storefront/layout-check"
import { hydrateMarquee } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import { MARQUEE_DEFAULTS, MARQUEE_LIMITS, MARQUEE_SETTINGS, marquee } from "../sections/marquee"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-marquee.ts"
)

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const strip = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "marquee",
  items: [{ text: "{ücretsiz_kargo_eşiği} üzeri kargo bedava" }],
  ...more,
})
const bar = { id: "duyuru0001", type: "announcement_bar", lines: ["Kargo bedava"] }
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the scrolling strip (adr/0049 Ek 2026-11-14 §4.1)", () => {
  it("fills a new strip's steps and an item's optional parts", () => {
    const doc = layoutDocument.parse({ home: [strip("kayan00001")] })

    expect(doc.home[0]).toEqual({
      ...strip("kayan00001"),
      ...ALWAYS,
      device: "all",
      ...MARQUEE_DEFAULTS,
      items: [
        {
          icon: null,
          text: "{ücretsiz_kargo_eşiği} üzeri kargo bedava",
          subtext: null,
          link: null,
        },
      ],
    })
    expect(doc.home[0]).not.toHaveProperty("look")
  })

  it("stands on the home, product and category pages, the category's with its place", () => {
    const doc = layoutDocument.parse({
      home: [strip("kayan00001", { size: "large", ground: "primary" })],
      product: [strip("kayan00002", { look: { space_outer: "none" } })],
      category: [strip("kayan00003", { placement: "top" })],
    })

    expect(doc.home[0]).toMatchObject({ size: "large", ground: "primary" })
    expect(doc.product[0]).toMatchObject({ look: { space_outer: "none" } })
    expect(doc.category[0]).toMatchObject({ placement: "top" })
  })

  it("takes one to eight items, an icon off the badges' list or a step off its list refused", () => {
    const items = (count: number) => Array.from({ length: count }, () => ({ text: "Kargo" }))

    expect(issues({ home: [strip("kayan00001", { items: items(8) })] })).toEqual([])
    expect(issues({ home: [strip("kayan00001", { items: [] })] })).toHaveLength(1)
    expect(issues({ home: [strip("kayan00001", { items: items(9) })] })).toHaveLength(1)
    expect(issues({ home: [strip("kayan00001", { speed: "warp" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [strip("kayan00001", { size: 24 })] })).toHaveLength(1)
    expect(
      issues({ home: [strip("kayan00001", { items: [{ text: "Kargo", icon: "rocket" }] })] })
    ).toEqual(["storefront_layout.section_invalid"])
  })

  it("keeps the newer settings (adr/0049 Ek 2026-11-15), the pause button never taken away", () => {
    const set = {
      speed: "fastest",
      hover_pause: "off",
      pause_button: "hover",
      weight: "normal",
      uppercase: "on",
      gap: "wide",
      outline: "on",
      closable: "on",
    }
    const doc = layoutDocument.parse({ home: [strip("kayan00001", { size: "large", ...set })] })

    expect(doc.home[0]).toMatchObject(set)
    expect(issues({ home: [strip("kayan00001", { pause_button: "none" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [strip("kayan00001", { closable: true })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("reads a strip saved before the newer settings as it was drawn then", () => {
    const saved = { speed: "slow", direction: "right", ground: "light", size: "small" }
    const doc = layoutDocument.parse({
      home: [strip("kayan00001", { ...saved, separator: "line" })],
    })

    expect(doc.home[0]).toMatchObject({ ...MARQUEE_DEFAULTS, ...saved, separator: "line" })
  })

  it("holds an item's lines to their lengths and the shop's details", () => {
    const one = (item: Record<string, unknown>) => ({
      home: [strip("kayan00001", { items: [item] })],
    })

    expect(issues(one({ text: "a".repeat(MARQUEE_LIMITS.text) }))).toEqual([])
    expect(issues(one({ text: "a".repeat(MARQUEE_LIMITS.text + 1) }))).toHaveLength(1)
    expect(
      issues(one({ text: "Kargo", subtext: "b".repeat(MARQUEE_LIMITS.subtext + 1) }))
    ).toHaveLength(1)
    expect(issues(one({ text: "{kupon}" }))).toEqual(["storefront_layout.token_unknown"])
    expect(issues(one({ text: "", subtext: "Alt satır" }))).toHaveLength(1)
  })

  it("links only where a menu may: a record, a page, a legal text or an https address", () => {
    const linked = (link: unknown) => ({
      home: [strip("kayan00001", { items: [{ text: "Kampanya", link }] })],
    })

    expect(issues(linked({ kind: "system", target: "shop", label: null }))).toEqual([])
    expect(issues(linked({ kind: "url", url: "https://ornek.com/a", label: "Git" }))).toEqual([])
    expect(issues(linked({ kind: "url", url: "javascript:alert(1)", label: "Git" }))).toHaveLength(
      1
    )
    expect(issues(linked({ kind: "url", url: "http://ornek.com", label: "Git" }))).toHaveLength(1)
  })

  it("stands once in the header, beside the announcement bar, without a look", () => {
    const doc = layoutDocument.parse({ header: [bar, strip("kayan00001", { size: "small" })] })

    expect(doc.header.map((section) => section.type)).toEqual(["announcement_bar", "marquee"])
    expect(issues({ header: [strip("kayan00001"), strip("kayan00002")] })).toEqual([
      "storefront_layout.section_duplicate",
    ])
    expect(issues({ header: [strip("kayan00001", { look: { width: "full" } })] })).toHaveLength(1)
    expect(issues({ footer: [strip("kayan00001")] }).length).toBeGreaterThan(0)
  })

  it("lets a page show two strips at most, the header's counted on every page", () => {
    expect(issues({ home: [strip("kayan00001"), strip("kayan00002")] })).toEqual([])
    expect(
      issues({ home: [strip("kayan00001"), strip("kayan00002"), strip("kayan00003")] })
    ).toEqual(["storefront_layout.marquee_limit"])
    expect(
      issues({
        header: [strip("kayan00000")],
        home: [strip("kayan00001")],
        product: [strip("kayan00002")],
        category: [strip("kayan00003", { placement: "top" })],
      })
    ).toEqual([])
    expect(
      issues({
        header: [strip("kayan00000")],
        category: [
          strip("kayan00001", { placement: "top" }),
          strip("kayan00002", { visible: false }),
        ],
      })
    ).toEqual(["storefront_layout.marquee_limit"])
  })

  it("names its items' links for the save's checks and the reading, in the header too", () => {
    const shop = { kind: "system", target: "shop", label: null } as const
    const category = { kind: "category", target: "pcat_01", label: "Bıçaklar" } as const
    const doc = layoutDocument.parse({
      header: [bar, strip("kayan00000", { items: [{ text: "Mağaza", link: shop }] })],
      home: [strip("kayan00001", { items: [{ text: "A", link: category }, { text: "B" }] })],
    })

    const [home] = doc.home
    expect(home && linksOf(home)).toEqual([category])
    expect(headerLinked(doc).flatMap(linksOf)).toEqual([shop])
  })

  it("prints its items' words filled and a broken link as none, the item kept", () => {
    const shop = { kind: "system", target: "shop", label: null } as const
    const gone = { kind: "product", target: "prod_01", label: null } as const
    const section = marquee.parse(
      strip("kayan00001", {
        separator: "star",
        items: [
          {
            text: "{ücretsiz_kargo_eşiği} üzeri kargo",
            subtext: "Bugün",
            icon: "truck",
            link: shop,
          },
          { text: "İade", link: gone },
        ],
      })
    )
    const [first, second] = section.items
    const at = {
      values: { ücretsiz_kargo_eşiği: "1.500 TL" },
      links: new Map<unknown, unknown>([
        [first?.link, { label: null, kind: "system", target: "shop", path: null }],
        [second?.link, null],
      ]),
    } as unknown as HydrateContext

    expect(hydrateMarquee(section, at)).toEqual({
      id: "kayan00001",
      type: "marquee",
      items: [
        {
          icon: "truck",
          text: "1.500 TL üzeri kargo",
          subtext: "Bugün",
          link: { label: null, kind: "system", target: "shop", path: null },
        },
        { icon: null, text: "İade", subtext: null, link: null },
      ],
      ...MARQUEE_DEFAULTS,
      separator: "star",
    })
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(MARQUEE_SETTINGS).toEqual(contract["MARQUEE_SETTINGS"])
    expect(MARQUEE_DEFAULTS).toEqual(contract["MARQUEE_DEFAULTS"])
    expect(MARQUEE_LIMITS).toEqual(contract["MARQUEE_LIMITS"])
  })
})
