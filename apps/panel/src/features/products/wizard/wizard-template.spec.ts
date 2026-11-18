import { describe, expect, it } from "vitest"
import type { AttributeDefinition, AttributeTemplate } from "@/features/attributes/types"
import { missingRequired, withRequiredSwitches } from "./wizard-template"

const definition = (patch: Partial<AttributeDefinition>): AttributeDefinition => ({
  id: `def_${patch.key ?? "x"}`,
  key: "x",
  label: "X",
  type: "text",
  unit: null,
  options: null,
  rank: 0,
  is_required: false,
  is_filterable: false,
  is_seo_highlight: false,
  scope: "product",
  option_title: null,
  varies_by: null,
  ...patch,
})

const template = {
  id: "tpl_1",
  name: "Kupa",
  definitions: [
    definition({ key: "material", is_required: true }),
    definition({ key: "colours", type: "multi_select", is_required: true, rank: 1 }),
    definition({ key: "handmade", type: "boolean", is_required: true, rank: 2 }),
    definition({ key: "note", rank: 3 }),
    definition({ key: "size", scope: "variant", is_required: true, rank: 4 }),
  ],
} as unknown as AttributeTemplate

describe("missingRequired", () => {
  it("names the required product fields left empty, never a variant one or a switch", () => {
    expect(missingRequired(template, { colours: [] })).toEqual(["material", "colours"])
  })

  it("is empty once they are filled, and without a template", () => {
    expect(missingRequired(template, { material: "Seramik", colours: ["mavi"] })).toEqual([])
    expect(missingRequired(null, {})).toEqual([])
  })
})

describe("withRequiredSwitches", () => {
  it("sends a required switch never turned as no, keeping a turned one", () => {
    expect(withRequiredSwitches(template, { material: "Seramik" })).toEqual({
      handmade: false,
      material: "Seramik",
    })
    expect(withRequiredSwitches(template, { handmade: true })["handmade"]).toBe(true)
  })
})
