import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import i18n from "i18next"
import { choiceKey, hasWork, optionsFor, runInput, valuesToWrite } from "./choices"
import { factValueText } from "./format"
import type { FactsPreview, FieldSuggestion } from "./types"

const suggestion = (more: Partial<FieldSuggestion> = {}): FieldSuggestion => ({
  name: "garanti",
  label: "Garanti",
  key: "garanti",
  type: "text",
  unit: null,
  options: null,
  group: null,
  products: 2,
  values: ["2 yıl", "3 yıl"],
  ...more,
})

const preview = (more: Partial<FactsPreview> = {}): FactsPreview => ({
  products: [
    {
      id: "prod_1",
      title: "Bir",
      template_id: "atpl_1",
      template_given: false,
      source: "doc",
      rows: [
        {
          label: "Uzunluk",
          value: "22 cm",
          source_path: "content.0",
          status: "ready",
          field: "uzunluk",
          value_parsed: 22,
        },
        {
          label: "Boy",
          value: "22",
          source_path: "content.1",
          status: "ready",
          field: "uzunluk",
          value_parsed: 22,
        },
        {
          label: "Renk",
          value: "Siyah",
          source_path: "content.2",
          status: "filled",
          field: "renk",
          value_parsed: "siyah",
          current: "beyaz",
        },
        { label: "Garanti", value: "2 yıl", source_path: "content.3", status: "unmatched" },
      ],
    },
  ],
  suggestions: [
    {
      template_id: "atpl_1",
      fields: [
        suggestion(),
        suggestion({ name: "kasa-rengi", label: "Kasa Rengi", key: "kasa_rengi" }),
      ],
    },
  ],
  counts: {
    products: 1,
    with_facts: 1,
    no_template: 0,
    ready: 2,
    same: 0,
    filled: 1,
    unparsed: 0,
    conflict: 0,
    ambiguous: 0,
    unmatched: 1,
  },
  suggested_template_id: null,
  ...more,
})

describe("the facts preview's choices (adr/0013 Ek 2026-11-05)", () => {
  it("counts each product's fields once, the filled ones only when written over", () => {
    expect(valuesToWrite(preview(), false)).toBe(1)
    expect(valuesToWrite(preview(), true)).toBe(2)
  })

  it("leaves every label until the shop ticks it", () => {
    const input = runInput(["prod_1"], preview(), {}, { overwrite: false, templateId: null })
    expect(input).toEqual({
      product_ids: ["prod_1"],
      overwrite: false,
      fields: [],
      aliases: [],
    })
    expect(hasWork(preview(), input)).toBe(true)
    expect(hasWork(preview({ products: [] }), input)).toBe(false)
  })

  it("adds a ticked label as a field of the kind picked, and links another as a field's name", () => {
    const input = runInput(
      ["prod_1"],
      preview(),
      {
        [choiceKey("atpl_1", "garanti")]: {
          add: true,
          type: "select",
          group: "genel",
          aliasOf: "",
        },
        [choiceKey("atpl_1", "kasa-rengi")]: {
          add: false,
          type: "text",
          group: "",
          aliasOf: "renk",
        },
      },
      { overwrite: true, templateId: "atpl_1" }
    )
    expect(input).toEqual({
      product_ids: ["prod_1"],
      template_id: "atpl_1",
      overwrite: true,
      fields: [
        {
          template_id: "atpl_1",
          label: "Garanti",
          type: "select",
          unit: null,
          // A choice made from text: one option per value the products wrote
          options: [
            { value: "2-yil", label: "2 yıl" },
            { value: "3-yil", label: "3 yıl" },
          ],
          group: "genel",
        },
      ],
      aliases: [{ template_id: "atpl_1", key: "renk", label: "Kasa Rengi" }],
    })
  })

  it("keeps a number's unit and a choice's own options", () => {
    expect(optionsFor(suggestion({ options: [{ value: "a", label: "A" }] }))).toEqual([
      { value: "a", label: "A" },
    ])
    const input = runInput(
      ["prod_1"],
      preview({
        suggestions: [
          { template_id: "atpl_1", fields: [suggestion({ type: "number", unit: "yıl" })] },
        ],
      }),
      { [choiceKey("atpl_1", "garanti")]: { add: true, type: "number", group: "", aliasOf: "" } },
      { overwrite: false, templateId: null }
    )
    expect(input.fields[0]).toMatchObject({
      type: "number",
      unit: "yıl",
      options: null,
      group: null,
    })
  })

  it("shows a value as the field takes it", () => {
    const t = i18n.t.bind(i18n)
    const options = [{ value: "siyah", label: "Siyah" }]
    expect(factValueText(t, { unit: "cm", options: null }, 22.5)).toBe("22,5 cm")
    expect(factValueText(t, { unit: null, options }, "siyah")).toBe("Siyah")
    expect(factValueText(t, { unit: null, options }, ["siyah", "mor"])).toBe("Siyah, mor")
    expect(factValueText(t, undefined, true)).toBe(i18n.t("attributes.facts.yes"))
    expect(factValueText(t, undefined, null)).toBe("")
  })
})
