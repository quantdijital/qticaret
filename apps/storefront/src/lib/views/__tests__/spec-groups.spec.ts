import { describe, expect, it } from "vitest"
import type { StoreAttributeValue } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { specGroupsOf, specsOf } from "../specs"

type Definition = StoreAttributeValue["definition"]

const GROUPS = [
  { key: "handle", name: "Sap", rank: 1 },
  { key: "blade", name: "Bıçak", rank: 0 },
]

const text = (
  key: string,
  label: string,
  rank: number,
  group: string | null,
  extra: Partial<Definition> = {}
): StoreAttributeValue => ({
  id: `atval_${key}`,
  value_text: `${label} değeri`,
  value_number: null,
  value_boolean: null,
  value_options: null,
  definition: {
    key,
    label,
    type: "text",
    unit: null,
    rank,
    options: null,
    is_seo_highlight: false,
    group,
    ...extra,
  },
})

// adr/0013 Ek 2026-11-04: the spec table's sections
describe("specGroupsOf", () => {
  it("puts each attribute in its section, sections in their order, the loose ones last", () => {
    const withTemplate = { template: { groups: GROUPS } }
    const groups = specGroupsOf(
      [
        text("wood", "Sap ağacı", 0, "handle", withTemplate),
        text("steel", "Çelik", 2, "blade", withTemplate),
        text("length", "Uzunluk", 1, "blade", withTemplate),
        text("note", "Not", 3, null, withTemplate),
        // A key the template no longer has reads as loose
        text("old", "Eski", 4, "gone", withTemplate),
      ],
      t
    )
    expect(groups.map((group) => [group.title, group.rows.map((row) => row.label)])).toEqual([
      ["Bıçak", ["Uzunluk", "Çelik"]],
      ["Sap", ["Sap ağacı"]],
      [null, ["Not", "Eski"]],
    ])
  })

  it("is one untitled group without sections: the plain table, as specsOf reads it", () => {
    const attributes = [text("a", "A", 1, null), text("b", "B", 0, null)]
    expect(specGroupsOf(attributes, t)).toEqual([{ title: null, rows: specsOf(attributes, t) }])
  })

  it("leaves out an empty section and gives nothing without values", () => {
    const empty = { ...text("x", "X", 0, "handle", { template: { groups: GROUPS } }) }
    expect(specGroupsOf([{ ...empty, value_text: " " }], t)).toEqual([])
    expect(specGroupsOf(null, t)).toEqual([])
  })
})
