import { LAYOUT_LIMITS } from "../../layout-fields"
import { presetDocument, presetTheme, withShopPages } from "../document"
import { resolvePreset } from "../resolve"
import type { PresetLookups } from "../resolve"
import { fixturePreset } from "./fixture-packs"

// A test-local look: the mechanism, not a shipped look
const preset = fixturePreset()
const KEPT = { trust_badges: null, color_swatches: null, low_stock: null }
const APPLIED = { pack: "general", code: "sade", version: preset.version }

const ABOUT = "cnt_01KABOUT0000000000000000"
const CONTACT = "cnt_01KCONTACT00000000000000"
const STORY = "cnt_01KSTORY000000000000000"

const help = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "help",
  title: "Hangi bıçak size uygun?",
  text: null,
  ...more,
})
const page = (handle: string, sections: unknown[], name?: string) => ({
  page_id: { $handle: `page:${handle}` },
  ...(name ? { name } : {}),
  sections,
})

const lookups = (records: [string, string][]): PresetLookups => ({
  records: new Map(records),
  links: new Map(),
  images: new Map(),
})

describe("a preset's content page layouts (adr/0073 §4)", () => {
  it("lays out the shop's page by its handle, a draft page as well as a live one", () => {
    const resolved = resolvePreset(
      { pages: [page("hakkimizda", [help("hkyardim01")], "Hakkımızda")] },
      null,
      // The lookup finds a page by its handle whatever its state (`recordsByHandle`)
      lookups([["page:hakkimizda", ABOUT]])
    )

    expect(resolved.pages).toEqual([{ page_id: ABOUT, sections: [help("hkyardim01")] }])
    expect(resolved.skipped).toEqual([])
    expect(resolved.dropped).toEqual([])
  })

  it("leaves out a page the shop has not made and the apply did not open, naming it", () => {
    const resolved = resolvePreset(
      {
        home: [help("anayardim1")],
        pages: [
          page("hakkimizda", [help("hkyardim01")], "Hakkımızda"),
          page("sss", [help("sssyardim1")]),
        ],
      },
      null,
      lookups([])
    )

    expect(resolved.pages).toEqual([])
    expect(resolved.groups.home).toEqual([help("anayardim1")])
    expect(resolved.skipped).toEqual([
      { where: "pages", ref: "page:hakkimizda", name: "Hakkımızda", reason: "missing" },
      // No name in the preset: the panel says the address alone
      { where: "pages", ref: "page:sss", reason: "missing" },
    ])
    // The page is not a section: nothing is named dropped
    expect(resolved.dropped).toEqual([])
  })

  it("never lays out another kind's record as a page (security review S9)", () => {
    const resolved = resolvePreset(
      {
        pages: [page("hakkimizda", [help("hkyardim01")])].map((each) => ({
          ...each,
          page_id: { $handle: "category:cakilar" },
        })),
      },
      null,
      lookups([["category:cakilar", "pcat_01KCAKILAR00000000000000"]])
    )

    expect(resolved.pages).toEqual([])
    expect(resolved.skipped).toEqual([
      { where: "pages", ref: "category:cakilar", reason: "missing" },
    ])
  })

  it("names a page whose address another record held, so no draft was opened (Ek 2026-11-19 (2) K6)", () => {
    const resolved = resolvePreset(
      { pages: [page("hakkimizda", [help("hkyardim01")], "Hakkımızda")] },
      null,
      { ...lookups([]), taken: new Set(["page:hakkimizda"]) }
    )

    expect(resolved.pages).toEqual([])
    expect(resolved.skipped).toEqual([
      { where: "pages", ref: "page:hakkimizda", name: "Hakkımızda", reason: "taken" },
    ])
  })

  it("leaves out a page the design has no room for, keeping the rest of the look (warn, don't block)", () => {
    // The design's pages laid out already (fifty since Ek 2026-11-19 (2) K1), Hakkımızda among them
    const laidOut = [
      ABOUT,
      ...Array.from(
        { length: LAYOUT_LIMITS.pages - 1 },
        (_, index) => `cnt_01KPAGE${String(index).padStart(2, "0")}`
      ),
    ]
    const resolved = resolvePreset(
      {
        home: [help("anayardim1")],
        pages: [
          page("hakkimizda", [help("hkyardim01")], "Hakkımızda"),
          page("hikayemiz", [help("hikyardim1")], "Hikâyemiz"),
          page("sss", [help("sssyardim1")]),
        ],
      },
      null,
      {
        ...lookups([
          ["page:hakkimizda", ABOUT],
          ["page:hikayemiz", STORY],
          ["page:sss", CONTACT],
        ]),
        laid_out: laidOut,
      }
    )

    // A page with a layout already is replaced; a new one past the limit is left out, named
    expect(resolved.pages).toEqual([{ page_id: ABOUT, sections: [help("hkyardim01")] }])
    expect(resolved.groups.home).toEqual([help("anayardim1")])
    expect(resolved.skipped).toEqual([
      { where: "pages", ref: "page:hikayemiz", name: "Hikâyemiz", reason: "limit" },
      { where: "pages", ref: "page:sss", reason: "limit" },
    ])
    expect(resolved.dropped).toEqual([])
  })

  it("adds new pages while there is room, the one past the limit left out", () => {
    const laidOut = Array.from(
      { length: LAYOUT_LIMITS.pages - 1 },
      (_, index) => `cnt_01KPAGE${String(index)}`
    )
    const resolved = resolvePreset(
      {
        pages: [
          page("hakkimizda", [help("hkyardim01")], "Hakkımızda"),
          page("hikayemiz", [help("hikyardim1")], "Hikâyemiz"),
        ],
      },
      null,
      {
        ...lookups([
          ["page:hakkimizda", ABOUT],
          ["page:hikayemiz", STORY],
        ]),
        laid_out: laidOut,
      }
    )

    expect(resolved.pages.map((each) => each.page_id)).toEqual([ABOUT])
    expect(resolved.skipped).toEqual([
      { where: "pages", ref: "page:hikayemiz", name: "Hikâyemiz", reason: "limit" },
    ])
    // Merged with the draft's own, the design holds its limit
    const shop = laidOut.map((id) => ({ page_id: id, sections: [help("eskiyardim")] }))
    expect(withShopPages(resolved.pages, shop).pages).toHaveLength(LAYOUT_LIMITS.pages)
  })

  it("drops a page's section whose record the shop lacks, and a page left with none", () => {
    const featured = (id: string) => ({
      id,
      type: "featured_product",
      product_id: { $handle: "product:yok" },
    })
    const resolved = resolvePreset(
      {
        pages: [
          page("hakkimizda", [featured("hkurun0001"), help("hkyardim01")]),
          page("hikayemiz", [featured("hikurun001")]),
        ],
      },
      null,
      lookups([
        ["page:hakkimizda", ABOUT],
        ["page:hikayemiz", STORY],
      ])
    )

    expect(resolved.pages).toEqual([{ page_id: ABOUT, sections: [help("hkyardim01")] }])
    expect(resolved.dropped).toEqual(["pages.hakkimizda.hkurun0001", "pages.hikayemiz.hikurun001"])
    expect(resolved.skipped).toEqual([
      { where: "pages.hakkimizda.hkurun0001", ref: "product:yok" },
      { where: "pages.hikayemiz.hikurun001", ref: "product:yok" },
    ])
  })
})

describe("the shop's content page layouts under a preset (adr/0073 §4)", () => {
  // As the draft is read (`storedDocument`): one list, an older `placement` read away (K1)
  const shopContact = { page_id: CONTACT, sections: [help("iletisim01")] }
  const shopAbout = { page_id: ABOUT, sections: [help("eskiyardim")] }

  it("replaces a page the preset lays out and keeps every other, naming them", () => {
    const presetAbout = { page_id: ABOUT, sections: [help("hkyardim01")] }

    const out = withShopPages([presetAbout], [shopContact, shopAbout])

    // The shop's order kept; the named page takes the preset's layout in its place
    expect(out.pages).toEqual([shopContact, presetAbout])
    expect(out.kept).toEqual([`pages.${CONTACT}`])
  })

  it("adds a page the shop had no layout for, after the shop's own", () => {
    const presetStory = { page_id: STORY, sections: [help("hkyardim01")] }

    expect(withShopPages([presetStory], [shopContact])).toEqual({
      pages: [shopContact, presetStory],
      kept: [`pages.${CONTACT}`],
    })
    expect(withShopPages([], [])).toEqual({ pages: [], kept: [] })
  })

  it("keeps the shop's page whose every section of the preset went", () => {
    // Resolved, the preset's page is gone: the shop's own layout for it stays
    expect(withShopPages([], [shopAbout])).toEqual({
      pages: [shopAbout],
      kept: [`pages.${ABOUT}`],
    })
  })

  it("writes a draft the editor's schema takes, the preset's page with the shop's kept", () => {
    const resolved = resolvePreset(
      { ...preset.layout, pages: [page("hakkimizda", [help("hkyardim01")])] },
      preset.menus,
      {
        ...lookups([["page:hakkimizda", ABOUT]]),
        links: new Map([["/magaza", { kind: "system" as const, target: "shop" as const }]]),
      }
    )
    const pages = withShopPages(resolved.pages, [shopContact])

    const doc = presetDocument(
      { groups: resolved.groups, menus: resolved.menus, pages: pages.pages },
      presetTheme(preset.theme_settings),
      APPLIED,
      KEPT
    )

    expect(doc.pages.map((each) => [each.page_id, each.sections.map((s) => s.id)])).toEqual([
      [CONTACT, ["iletisim01"]],
      [ABOUT, ["hkyardim01"]],
    ])
  })

  it("writes nothing for a page section the editor's schema refuses (the page's own types)", () => {
    const opening = { id: "hkacilis01", type: "hero", title: "Hakkımızda" }
    const resolved = resolvePreset(
      { pages: [page("hakkimizda", [opening])] },
      null,
      lookups([["page:hakkimizda", ABOUT]])
    )

    expect(() =>
      presetDocument(
        { groups: resolved.groups, menus: null, pages: resolved.pages },
        presetTheme(preset.theme_settings),
        APPLIED,
        KEPT
      )
    ).toThrow("storefront_preset.layout_invalid")
  })
})
