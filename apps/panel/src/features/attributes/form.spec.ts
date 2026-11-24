import { describe, expect, it } from "vitest"
import {
  definitionsApi,
  emptyDefinition,
  keyFromLabel,
  optionValue,
  carriedChanged,
  removedDefinitions,
  templateForm,
  withAdded,
} from "./form"
import type { AttributeTemplate } from "./types"

const template = {
  id: "tpl_1",
  name: "Bıçak",
  handle: "bicak",
  description: null,
  definitions: [
    {
      id: "def_b",
      key: "uzunluk",
      label: "Uzunluk",
      type: "number",
      unit: "cm",
      options: null,
      rank: 1,
    },
    {
      id: "def_a",
      key: "celik",
      label: "Çelik",
      type: "select",
      unit: null,
      options: [{ value: "vg10", label: "VG10" }],
      rank: 0,
    },
  ],
} as unknown as AttributeTemplate

describe("attribute template form", () => {
  it("makes keys and option values the server accepts from Turkish labels", () => {
    expect(keyFromLabel("Bıçak Uzunluğu")).toBe("bicak_uzunlugu")
    expect(keyFromLabel("3 Katlı")).toBe("a_3_katli")
    expect(optionValue("Paslanmaz Çelik")).toBe("paslanmaz-celik")
  })

  it("orders definitions by rank and sends list order back as rank", () => {
    const form = templateForm(template)
    expect(form.definitions.map((definition) => definition.key)).toEqual(["celik", "uzunluk"])
    expect(
      definitionsApi(form.definitions).map((definition) => [definition.key, definition.rank])
    ).toEqual([
      ["celik", 0],
      ["uzunluk", 1],
    ])
  })

  it("keeps a hidden attribute out of filters and titles, and a product option shown (T5)", () => {
    const [hidden, option] = definitionsApi([
      {
        ...emptyDefinition(),
        label: "Tedarikçi kodu",
        is_public: false,
        is_filterable: true,
        is_seo_highlight: true,
      },
      {
        ...emptyDefinition(),
        label: "Beden",
        scope: "variant",
        option_title: "Beden",
        is_public: false,
      },
    ])

    expect(hidden).toMatchObject({
      is_public: false,
      is_filterable: false,
      is_seo_highlight: false,
    })
    expect(option?.is_public).toBe(true)
    // Saved before visibility existed: shown
    expect(templateForm(template).definitions.every((definition) => definition.is_public)).toBe(
      true
    )
  })

  it("drops options from non-select types and variant fields from product ones", () => {
    const [sent] = definitionsApi([
      {
        ...emptyDefinition(),
        label: "Not",
        options: [{ value: "x", label: "X" }],
        option_title: "Renk",
      },
    ])
    expect(sent).toMatchObject({ key: "not", options: null, option_title: null, varies_by: null })
  })

  it("finds the saved definitions a form removed", () => {
    const form = templateForm(template)
    form.definitions = form.definitions.filter((definition) => definition.key !== "uzunluk")
    expect(removedDefinitions(template, form).map((definition) => definition.id)).toEqual(["def_b"])
  })
})

describe("carried add-on templates (adr/0052 Ek 2026-11-23)", () => {
  it("starts from the saved list and tells a change, order included", () => {
    const saved = { ...template, addon_template_ids: ["adtpl_1", "adtpl_2"] } as AttributeTemplate
    const form = templateForm(saved)
    expect(form.addonTemplateIds).toEqual(["adtpl_1", "adtpl_2"])
    expect(carriedChanged(saved, form)).toBe(false)
    expect(carriedChanged(saved, { ...form, addonTemplateIds: ["adtpl_2", "adtpl_1"] })).toBe(true)
    expect(carriedChanged(null, templateForm(null))).toBe(false)
  })
})

describe("withAdded", () => {
  it("shows values added from a product until the saved group has them, once each", () => {
    const steel = { value: "steel", label: "Çelik" }
    const bamboo = { value: "bambu", label: "Bambu" }
    expect(withAdded([steel], [bamboo])).toEqual([steel, bamboo])
    expect(withAdded([steel, bamboo], [bamboo])).toEqual([steel, bamboo])
  })
})
