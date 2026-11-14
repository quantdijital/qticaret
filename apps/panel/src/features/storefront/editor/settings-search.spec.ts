import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import type { AnySection, LayoutDocument, LayoutGroup } from "@/features/storefront/api/layout"
import {
  newAnnouncementBar,
  newFooterNewsletter,
  newHomeSection,
} from "@/features/storefront/layout/sections"
import { SEARCH_LIMIT, searchSettings, searchText, searchedSections } from "./settings-search"
import type { SearchHit } from "./settings-search"

const t = (key: string) => i18next.t(key)

const doc = {
  header: [
    newAnnouncementBar("duyuru0001"),
    {
      id: "ustbilgi01",
      type: "header_bar",
      visible: true,
      starts_at: null,
      ends_at: null,
      variant: "standard",
      sticky: true,
    },
  ],
  home: [
    { ...newHomeSection("faq", "sss000001"), title: "Sık sorulanlar" },
    newHomeSection("trust_badges", "guvenserit"),
    newHomeSection("products", "rafyeni001"),
  ],
  footer: [newFooterNewsletter("bulten0001")],
  product: [newHomeSection("help", "yardim0001")],
  category: [],
} as unknown as LayoutDocument

const names = (section: AnySection, group: LayoutGroup) => [
  section.id,
  t(`storefront.editor.types.${group === "footer" ? "footer_newsletter" : section.type}.name`),
]

const search = (query: string) => searchSettings(query, searchedSections(doc, "home", names), t)
const keys = (hits: SearchHit[]) => hits.map((hit) => `${hit.section.id}:${hit.field?.key ?? ""}`)

/** adr/0049 Ek 2026-11-14 §6: the settings search. */
describe("the theme editor's settings search", () => {
  it("compares Turkish case and accents away: ı and i, ş and s", () => {
    expect(searchText("  DIŞ   Boşluk ")).toBe("dis bosluk")
    expect(searchText("İç boşluk")).toBe("ic bosluk")
    expect(searchText("Hizalama")).toBe(searchText("HİZALAMA"))
  })

  it("finds a look field by its Turkish name, without accents, on every body section", () => {
    expect(keys(search("dış boşluk"))).toEqual([
      "sss000001:look.space_outer",
      "guvenserit:look.space_outer",
      "rafyeni001:look.space_outer",
    ])
    expect(keys(search("dis bosluk"))).toEqual(keys(search("dış boşluk")))
  })

  it("finds the same field by its technical term", () => {
    expect(keys(search("MARGIN"))).toEqual(keys(search("dış boşluk")))
    expect(search("padding").every((hit) => hit.field?.key === "look.space_inner")).toBe(true)
  })

  it("finds a variant and a step by its name, naming the choice", () => {
    const [lined] = search("çizgili")
    expect(lined).toMatchObject({
      field: { key: "variant" },
      option: "storefront.editor.variants.trust_badges.lined",
    })

    const stage = search("hafif ton")
    expect(stage.map((hit) => hit.field?.key)).toEqual([
      "look.ground",
      "look.ground",
      "look.ground",
    ])
  })

  it("finds a section by its name, and narrows to its fields with another word", () => {
    expect(keys(search("sss"))).toEqual(["sss000001:"])
    expect(keys(search("sss zemin"))).toEqual(["sss000001:look.ground"])
  })

  it("searches only the page being edited, and gives the header and footer no look", () => {
    expect(keys(search("yardim"))).toEqual([])
    expect(search("zemin").map((hit) => hit.group)).toEqual(["home", "home", "home"])
    expect(keys(search("başlangıç"))).toContain("duyuru0001:starts_at")
    expect(keys(search("başlangıç"))).toContain("bulten0001:starts_at")
  })

  it("finds the header's stickiness by its name and its term", () => {
    expect(keys(search("sabit"))).toEqual(["ustbilgi01:sticky"])
    expect(keys(search("sticky"))).toEqual(["ustbilgi01:sticky"])
  })

  it("offers alignment only where it means something", () => {
    expect(keys(search("hizalama"))).toEqual(["sss000001:look.align", "rafyeni001:look.align"])
  })

  it("finds nothing for an empty query, and caps a long list", () => {
    expect(search("   ")).toEqual([])
    expect(search("a").length).toBeLessThanOrEqual(SEARCH_LIMIT)
  })
})
