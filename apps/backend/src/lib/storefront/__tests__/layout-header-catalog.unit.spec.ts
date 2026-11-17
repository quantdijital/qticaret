import path from "node:path"
import { headerLinked, linksOf } from "../../../workflows/storefront/layout-check"
import { withShopNote } from "../../../workflows/storefront/layout-read"
import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"
import {
  HEADER_CATALOG_LIMITS,
  HEADER_MENU_GROUNDS,
  HEADER_SEARCH_WIDTHS,
  HEADER_TOOLS_PLACES,
  HEADER_TOP_LINKS_PLACES,
} from "../sections/main"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-variants.ts"
)

const LEFT = { layout: "left", sticky: true } as const
const catalog = (more: Record<string, unknown> = {}) => ({
  id: "mainheader",
  type: "header_bar",
  variant: "catalog",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

const DEFAULTS = {
  search_placeholder: null,
  search_label: false,
  account_text: true,
  cart_total: false,
  highlight_link: null,
  utility_bar: true,
  phone: true,
  categories_button: true,
  menu_ground: "stage",
  tools_place: "bar",
  top_links: "strip",
  search_width: "wide",
  strip_note: null,
  strip_note_link: null,
}

describe("the catalog header (adr/0049 Ek 2026-11-14 N14, Ek 2026-11-15)", () => {
  it("reads a bar switched to it with every setting's default", () => {
    const doc = layoutDocument.parse({ header: [catalog()] })
    expect(doc.header[0]).toMatchObject({ variant: "catalog", sticky: true, ...DEFAULTS })
  })

  it("keeps what the shop set and refuses a step off its list or too long words", () => {
    const set = {
      search_placeholder: "Ürün, marka ya da kod",
      search_label: true,
      account_text: false,
      cart_total: true,
      highlight_link: { kind: "system", target: "sale", label: "Kampanyalar" },
      utility_bar: false,
      phone: false,
      categories_button: false,
      menu_ground: "primary",
      tools_place: "row",
      top_links: "bar",
      search_width: "narrow",
    }
    expect(layoutDocument.parse({ header: [catalog(set)] }).header[0]).toMatchObject(set)
    // The light tint's old name reads, and is written again, as the dictionary's (bilesen-denetimi (b) 5)
    expect(
      layoutDocument.parse({ header: [catalog({ menu_ground: "light" })] }).header[0]
    ).toMatchObject({ menu_ground: "well" })
    expect(issues({ header: [catalog({ menu_ground: "red" })] })).toContain(
      "storefront_layout.section_invalid"
    )
    expect(
      issues({ header: [catalog({ search_placeholder: "a".repeat(61) })] }).length
    ).toBeGreaterThan(0)
    // A setting of the catalog bar on today's is a forged editor
    expect(issues({ header: [catalog({ variant: "standard", phone: true })] }).length).toBe(1)
  })

  it("drops its settings when a stored bar names a variant off the list, and keeps them on its own", () => {
    const stored = readStoredLayout({
      header: [{ ...catalog({ phone: false }), variant: "shrinking" }],
    })
    expect(stored.header[0]).toEqual(expect.objectContaining({ variant: "standard" }))
    expect(stored.header[0]).not.toHaveProperty("phone")
    const kept = readStoredLayout({ header: [catalog({ phone: false })] })
    expect(kept.header[0]).toMatchObject({ variant: "catalog", phone: false })
  })

  it("names its highlighted link for the save's checks and the reading", () => {
    const sale = { kind: "category", target: "pcat_01", label: "İndirim" } as const
    const doc = layoutDocument.parse({ header: [catalog({ highlight_link: sale })] })
    expect(headerLinked(doc).flatMap(linksOf)).toEqual([sale])
    expect(headerLinked(layoutDocument.parse({ header: [catalog()] })).flatMap(linksOf)).toEqual([])
  })

  it("gives the storefront its settings, the link placed (a broken one none)", () => {
    const sale = { kind: "system", target: "sale", label: null } as const
    const doc = withMainSections(
      layoutDocument.parse({ header: [catalog({ highlight_link: sale, cart_total: true })] }),
      LEFT
    )
    const placed = { label: "Kampanyalar", kind: "system", target: "sale", path: null }
    expect(mainSectionsOf(doc, () => placed).header_bar).toEqual({
      id: "mainheader",
      type: "header_bar",
      variant: "catalog",
      sticky: true,
      menu_images: "submenus",
      search_style: "field",
      catalog: { ...DEFAULTS, cart_total: true, highlight_link: placed },
    })
    expect(mainSectionsOf(doc).header_bar.catalog?.highlight_link).toBeNull()
    // Today's bar carries none
    const plain = withMainSections(layoutDocument.parse({}), LEFT)
    expect(mainSectionsOf(plain).header_bar).not.toHaveProperty("catalog")
  })

  it("refuses a layout step off its list on a save, and drops it from a stored bar", () => {
    for (const field of ["tools_place", "top_links", "search_width"]) {
      expect(issues({ header: [catalog({ [field]: "middle" })] })).toContain(
        "storefront_layout.section_invalid"
      )
      expect(issues({ header: [catalog({ [field]: true })] })).toContain(
        "storefront_layout.section_invalid"
      )
    }
    // A stored bar with a newer build's step reads with the default; the others it set stand
    const stored = readStoredLayout({
      header: [catalog({ tools_place: "floating", top_links: "bar", search_width: 3 })],
    })
    expect(stored.header[0]).toMatchObject({
      variant: "catalog",
      tools_place: "bar",
      top_links: "bar",
      search_width: "wide",
    })
  })

  describe("the strip's note (Ek 2026-11-15)", () => {
    const sale = { kind: "system", target: "sale", label: null } as const

    it("keeps a short plain line and its link, trimmed", () => {
      const bar = layoutDocument.parse({
        header: [catalog({ strip_note: "  Kargo 1500 TL üzeri bedava ", strip_note_link: sale })],
      }).header[0]
      expect(bar).toMatchObject({ strip_note: "Kargo 1500 TL üzeri bedava", strip_note_link: sale })
      // A bar stored before the note reads none (no migration)
      const stored = readStoredLayout({ header: [catalog({ phone: false })] })
      expect(layoutDocument.parse(stored).header[0]).toMatchObject({
        strip_note: null,
        strip_note_link: null,
      })
    })

    it("refuses a too long, blank, control-character or non-text note", () => {
      expect(issues({ header: [catalog({ strip_note: "a".repeat(80) })] })).toEqual([])
      for (const strip_note of ["a".repeat(81), "   ", "Kargo\u0007", 3, true, ["x"]]) {
        expect(issues({ header: [catalog({ strip_note })] }).length).toBeGreaterThan(0)
      }
    })

    it("takes the shop's details as tokens and refuses an unknown one", () => {
      const note = "{ücretsiz_kargo_eşiği} üzeri siparişlerde kargo bedava"
      expect(issues({ header: [catalog({ strip_note: note })] })).toEqual([])
      expect(issues({ header: [catalog({ strip_note: "{kargo_eşiği} üzeri bedava" })] })).toEqual([
        "storefront_layout.token_unknown",
      ])
    })

    it("is read filled, and not shown when a detail it names is not given", () => {
      const note = "{ücretsiz_kargo_eşiği} üzeri siparişlerde kargo bedava"
      const read = withMainSections(
        layoutDocument.parse({ header: [catalog({ strip_note: note, strip_note_link: sale })] }),
        LEFT
      )
      const main = mainSectionsOf(read)
      const values = {
        mağaza_adı: "Örnek",
        telefon: null,
        e_posta: null,
        adres: null,
        whatsapp: null,
        ücretsiz_kargo_eşiği: "₺1.500",
      }
      expect(withShopNote(main, values).header_bar.catalog?.strip_note).toBe(
        "₺1.500 üzeri siparişlerde kargo bedava"
      )
      // No threshold: no half sentence ("üzeri siparişlerde kargo bedava"), no note
      for (const threshold of [null, "", " ​ "]) {
        const none = withShopNote(main, { ...values, ücretsiz_kargo_eşiği: threshold })
        expect(none.header_bar.catalog?.strip_note).toBeNull()
      }
      // A note without tokens and the other headers are left as they are
      const plain = mainSectionsOf(
        withMainSections(
          layoutDocument.parse({ header: [catalog({ strip_note: "Yeni sezon" })] }),
          LEFT
        )
      )
      expect(withShopNote(plain, values).header_bar.catalog?.strip_note).toBe("Yeni sezon")
    })

    it("refuses a link that is not a safe one, as the highlighted link does", () => {
      for (const url of [
        "javascript:alert(1)",
        "//evil.example",
        "http://plain.example",
        "data:x",
      ]) {
        expect(
          issues({ header: [catalog({ strip_note_link: { kind: "url", url, label: "Git" } })] })
        ).toContain("storefront_menus.url_invalid")
      }
      expect(
        issues({
          header: [catalog({ strip_note_link: { kind: "url", url: "/kampanya", label: "Git" } })],
        })
      ).toEqual([])
    })

    it("names its link for the save's checks and gives the storefront it placed (a broken one none)", () => {
      const category = { kind: "category", target: "pcat_02", label: null } as const
      const doc = layoutDocument.parse({
        header: [catalog({ strip_note: "Yeni sezon", strip_note_link: category })],
      })
      expect(headerLinked(doc).flatMap(linksOf)).toEqual([category])
      const read = withMainSections(doc, LEFT)
      const placed = { label: "Yeni", kind: "category", target: "pcat_02", path: "/kategori/yeni" }
      expect(mainSectionsOf(read, () => placed).header_bar.catalog).toMatchObject({
        strip_note: "Yeni sezon",
        strip_note_link: placed,
      })
      expect(mainSectionsOf(read).header_bar.catalog).toMatchObject({
        strip_note: "Yeni sezon",
        strip_note_link: null,
      })
    })
  })

  it("mirrors the contract's ground list, layout steps and limits", () => {
    const contract = jest.requireActual<{
      HEADER_MENU_GROUNDS: unknown
      HEADER_TOOLS_PLACES: unknown
      HEADER_TOP_LINKS_PLACES: unknown
      HEADER_SEARCH_WIDTHS: unknown
      HEADER_CATALOG_LIMITS: unknown
    }>(CONTRACT_FILE)
    expect(HEADER_MENU_GROUNDS).toEqual(contract.HEADER_MENU_GROUNDS)
    expect(HEADER_TOOLS_PLACES).toEqual(contract.HEADER_TOOLS_PLACES)
    expect(HEADER_TOP_LINKS_PLACES).toEqual(contract.HEADER_TOP_LINKS_PLACES)
    expect(HEADER_SEARCH_WIDTHS).toEqual(contract.HEADER_SEARCH_WIDTHS)
    expect(HEADER_CATALOG_LIMITS).toEqual(contract.HEADER_CATALOG_LIMITS)
  })
})
