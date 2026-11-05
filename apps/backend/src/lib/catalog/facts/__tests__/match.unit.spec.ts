import type { FactRow } from "../extract"
import { matchFacts, valuesToWrite } from "../match"
import type { MatchField, MatchTemplate } from "../match"
import { parseValue } from "../parse"
import { previewFacts } from "../preview"
import { kindOf, suggestFields } from "../suggest"

const field = (patch: Partial<MatchField> & Pick<MatchField, "key" | "label">): MatchField => ({
  type: "text",
  unit: null,
  options: null,
  scope: "product",
  ...patch,
})

const OPTIONS = [
  { value: "paslanmaz-celik", label: "Paslanmaz çelik" },
  { value: "siyah", label: "Siyah" },
  { value: "beyaz", label: "Beyaz" },
]

const row = (label: string, value: string, extra: Partial<FactRow> = {}): FactRow => ({
  label,
  value,
  source_path: `content.0.content.${String(label.length)}`,
  ...extra,
})

describe("description facts: values by type", () => {
  const number = (unit: string | null) => ({ type: "number" as const, unit, options: null })

  it("reads numbers with units into the field's unit", () => {
    expect(parseValue(number("mm"), "22 cm")).toEqual({ ok: true, value: 220 })
    expect(parseValue(number("cm"), "22,5 cm")).toEqual({ ok: true, value: 22.5 })
    expect(parseValue(number("kg"), "1.250 g")).toEqual({ ok: true, value: 1.25 })
    expect(parseValue(number("cm"), "yaklaşık 3.5cm")).toEqual({ ok: true, value: 3.5 })
    expect(parseValue(number("cm"), "220 mm (8,7 inç)")).toEqual({ ok: true, value: 22 })
    expect(parseValue(number("HRC"), "58 HRC")).toEqual({ ok: true, value: 58 })
    expect(parseValue(number(null), "58 HRC")).toEqual({ ok: true, value: 58 })
    // The label's unit for a number written without one: "Boy (cm)"
    expect(parseValue(number("mm"), "22", "cm")).toEqual({ ok: true, value: 220 })
    expect(parseValue(number("cm"), "22")).toEqual({ ok: true, value: 22 })
  })

  it("refuses ranges, other units and words", () => {
    expect(parseValue(number("HRC"), "58-60 HRC")).toEqual({ ok: false, reason: "range" })
    expect(parseValue(number("cm"), "10 ile 12 cm")).toEqual({ ok: false, reason: "range" })
    expect(parseValue(number("cm"), "3 adet")).toEqual({ ok: false, reason: "unit" })
    expect(parseValue(number("cm"), "1 kg")).toEqual({ ok: false, reason: "unit" })
    expect(parseValue(number("cm"), "uzun")).toEqual({ ok: false, reason: "number" })
    // A number inside a name is no number
    expect(parseValue(number(null), "N690")).toEqual({ ok: false, reason: "number" })
  })

  it("reads choices by name or value, Turkish case folded", () => {
    const select = { type: "select" as const, unit: null, options: OPTIONS }
    expect(parseValue(select, "PASLANMAZ ÇELİK")).toEqual({ ok: true, value: "paslanmaz-celik" })
    expect(parseValue(select, "Siyah (mat)")).toEqual({ ok: true, value: "siyah" })
    expect(parseValue(select, "Kırmızı")).toEqual({ ok: false, reason: "option" })
    const multi = { type: "multi_select" as const, unit: null, options: OPTIONS }
    expect(parseValue(multi, "Siyah, Beyaz")).toEqual({ ok: true, value: ["siyah", "beyaz"] })
    expect(parseValue(multi, "Siyah ve Beyaz")).toEqual({ ok: true, value: ["siyah", "beyaz"] })
    expect(parseValue(multi, "Siyah, Mor")).toEqual({ ok: false, reason: "option" })
  })

  it("reads yes and no, and text", () => {
    const yesNo = { type: "boolean" as const, unit: null, options: null }
    expect(parseValue(yesNo, "Var")).toEqual({ ok: true, value: true })
    expect(parseValue(yesNo, "HAYIR")).toEqual({ ok: true, value: false })
    expect(parseValue(yesNo, "Bazen")).toEqual({ ok: false, reason: "boolean" })
    const text = { type: "text" as const, unit: null, options: null }
    expect(parseValue(text, "  El  yapımı ")).toEqual({ ok: true, value: "El yapımı" })
    expect(parseValue(text, "x".repeat(501))).toEqual({ ok: false, reason: "text" })
  })
})

describe("description facts: matching to the template", () => {
  const template: MatchTemplate = {
    id: "atpl_1",
    groups: [
      { key: "govde", name: "Gövde" },
      { key: "kapak", name: "Kapak" },
    ],
    definitions: [
      field({ key: "kasa_rengi", label: "Kasa Rengi", type: "select", options: OPTIONS }),
      field({ key: "uzunluk", label: "Uzunluk", type: "number", unit: "mm" }),
      field({ key: "malzeme", label: "Malzeme", group: "govde" }),
      field({ key: "kapak_malzemesi", label: "Malzeme", group: "kapak" }),
      field({ key: "mensei", label: "Menşei", aliases: ["Üretim yeri", "Made in"] }),
      field({ key: "beden", label: "Beden", scope: "variant" }),
    ],
  }

  it("matches by label, key or another name, Turkish case rules folded", () => {
    const rows = matchFacts(
      [
        row("KASA RENGİ", "Siyah"),
        row("uzunluk", "22 cm"),
        row("Üretim Yeri", "Türkiye"),
        row("Beden", "M"),
      ],
      template,
      {}
    )
    expect(rows.map((each) => [each.status, each.field ?? null, each.value_parsed])).toEqual([
      ["ready", "kasa_rengi", "siyah"],
      ["ready", "uzunluk", 220],
      ["ready", "mensei", "Türkiye"],
      // A variant attribute's values are the product's options
      ["unmatched", null, undefined],
    ])
  })

  it("tells two fields of one name apart by the row's section, else leaves it", () => {
    const rows = matchFacts(
      [
        row("Malzeme", "Alüminyum", { context: "Gövde" }),
        row("Malzeme", "Cam", { context: "Kapak", source_path: "content.1" }),
        row("Malzeme", "Ahşap", { source_path: "content.2" }),
      ],
      template,
      {}
    )
    expect(rows.map((each) => [each.status, each.field ?? each.fields])).toEqual([
      ["ready", "malzeme"],
      ["ready", "kapak_malzemesi"],
      ["ambiguous", ["malzeme", "kapak_malzemesi"]],
    ])
  })

  it("keeps the product's values unless asked to write over, and two values for one field go", () => {
    const rows = matchFacts(
      [
        row("Kasa rengi", "Beyaz"),
        row("Uzunluk", "22 cm"),
        row("Menşei", "Türkiye"),
        row("Made in", "Almanya"),
        row("Kasa rengi", "Kırmızı", { source_path: "content.9" }),
      ],
      template,
      { kasa_rengi: "siyah", uzunluk: 220 }
    )
    expect(rows.map((each) => [each.status, each.reason ?? null])).toEqual([
      ["filled", null],
      ["same", null],
      ["conflict", null],
      ["conflict", null],
      ["unparsed", "option"],
    ])
    expect(valuesToWrite(rows, false)).toEqual({})
    expect(valuesToWrite(rows, true)).toEqual({ kasa_rengi: "beyaz" })
  })
})

describe("description facts: fields to offer", () => {
  it("reads the kind from the values", () => {
    expect(kindOf([{ value: "22 cm" }, { value: "180 mm" }], 2)).toEqual({
      type: "number",
      unit: "cm",
      options: null,
    })
    expect(kindOf([{ value: "Var" }, { value: "Yok" }], 2).type).toBe("boolean")
    expect(kindOf([{ value: "Model 3" }, { value: "Model 4" }], 2).type).toBe("text")
    expect(kindOf([{ value: "Ceviz" }, { value: "Ceviz" }, { value: "Meşe" }], 3)).toEqual({
      type: "select",
      unit: null,
      options: [
        { value: "ceviz", label: "Ceviz" },
        { value: "mese", label: "Meşe" },
      ],
    })
    // One product: a choice is not read from it
    expect(kindOf([{ value: "Ceviz" }], 1).type).toBe("text")
  })

  it("groups unmatched labels across products with a free key and the section they sit in", () => {
    const template: MatchTemplate = {
      id: "atpl_1",
      groups: [{ key: "sap", name: "Sap" }],
      definitions: [field({ key: "sap_rengi", label: "Sap Rengi", group: "sap" })],
    }
    const products = ["a", "b", "c"].map((id, index) => ({
      id,
      title: id,
      doc: null,
      description: `Sap Rengi: Siyah\nSap Rengi Kodu: ${index === 2 ? "K2" : "K1"}\nMenşei: Türkiye`,
      template,
      values: {},
    }))
    const preview = previewFacts(products, null, [template])
    expect(preview.counts).toMatchObject({ products: 3, with_facts: 3, ready: 3, unmatched: 6 })
    const fields = suggestFields(
      preview.products.flatMap((product) =>
        product.rows
          .filter((each) => each.status === "unmatched")
          .map((each) => ({ product_id: product.id, row: each, group: each.group ?? null }))
      ),
      template
    )
    expect(fields.map((each) => [each.key, each.type, each.products, each.group])).toEqual([
      ["mensei", "select", 3, "sap"],
      ["sap_rengi_kodu", "select", 3, "sap"],
    ])
    expect(preview.suggestions[0]?.fields.map((each) => each.label)).toEqual([
      "Menşei",
      "Sap Rengi Kodu",
    ])
  })

  it("reads products without a template against the one given, and suggests one", () => {
    const template: MatchTemplate = {
      id: "atpl_2",
      definitions: [field({ key: "renk", label: "Renk" })],
    }
    const bare = {
      id: "p",
      title: "p",
      doc: null,
      description: "Renk: Mavi\nBoy: 40",
      template: null,
      values: {},
    }
    const unread = previewFacts([bare], null, [template])
    expect(unread.suggested_template_id).toBe("atpl_2")
    expect(unread.counts).toMatchObject({ no_template: 1, unmatched: 2 })
    expect(unread.suggestions).toEqual([])
    const read = previewFacts([bare], template, [template])
    expect(read.products[0]).toMatchObject({ template_id: "atpl_2", template_given: true })
    expect(read.counts).toMatchObject({ ready: 1, unmatched: 1, no_template: 0 })
  })
})
