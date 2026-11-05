import { descriptionOf } from "../../../lib/migration/description"
import { planAttributes } from "../attributes"
import type { SourceAttribute, TemplateFields } from "../attributes"
import { descriptionFactsOf, factsOutcome } from "../description-facts"

const choice = (value: string, label: string) => ({ value, label })

// A shop's template, neutral; one field is required
const HOME: TemplateFields = {
  handle: "ev",
  fields: [
    {
      key: "renk_tonu",
      label: "Renk",
      type: "select",
      scope: "product",
      is_required: false,
      options: [choice("acik", "Açık"), choice("koyu", "Koyu")],
    },
    {
      key: "agirlik",
      label: "Ağırlık",
      type: "number",
      unit: "g",
      scope: "product",
      is_required: false,
      options: null,
    },
    {
      key: "mensei",
      label: "Menşei",
      aliases: ["Üretim yeri"],
      type: "text",
      scope: "product",
      is_required: true,
      options: null,
    },
  ],
}

const attribute = (key: string, slug: string, values: string[]): SourceAttribute => ({
  key,
  slug,
  name: slug,
  values,
})

// A WooCommerce body as the import reads it into a document (adr/0055)
const facts = (html: string) => descriptionFactsOf(descriptionOf(html).doc)

describe("the facts in a moved product's description (adr/0013 Ek 2026-11-05)", () => {
  it("fills the chosen template's empty fields from the description's table", () => {
    const plan = planAttributes(
      [attribute("pa_renk", "renk", ["Koyu"])],
      [HOME],
      facts(`
        <h2>Teknik Özellikler</h2>
        <table>
          <tr><th>Özellik</th><th>Değer</th></tr>
          <tr><td>Ağırlık</td><td>1,2 kg</td></tr>
          <tr><td>Üretim Yeri</td><td>Türkiye</td></tr>
          <tr><td>Renk</td><td>Koyu</td></tr>
          <tr><td>Garanti</td><td>2 yıl</td></tr>
        </table>`)
    )
    expect(plan).toMatchObject({
      template: "ev",
      cells: { renk_tonu: "Koyu", agirlik: "1200", mensei: "Türkiye" },
      written: ["pa_renk"],
      requiredMissing: false,
      // The colour says what the attribute said; the warranty has no field
      facts: { written: 2, left: ["Garanti"] },
    })
  })

  it("leaves a fact that says otherwise than the source's attribute, or two facts at odds", () => {
    const plan = planAttributes(
      [attribute("pa_renk", "renk", ["Koyu"]), attribute("pa_mensei", "mensei", ["Yerli"])],
      [HOME],
      facts("<ul><li>Renk: Açık</li><li>Ağırlık: 300 g</li><li>Ağırlık: 0,5 kg</li></ul>")
    )
    expect(plan.cells).toEqual({ renk_tonu: "Koyu", mensei: "Yerli" })
    expect(plan.facts).toEqual({ cells: {}, written: 0, left: ["Renk", "Ağırlık", "Ağırlık"] })
  })

  it("reads the short description's lines too, once each (adr/0055 Ek 2026-11-05)", () => {
    const doc = descriptionOf("<ul><li>Menşei: Türkiye</li><li>Renk: Koyu</li></ul>").doc
    const rows = descriptionFactsOf(doc, ["Menşei: Türkiye", "Ağırlık: 1,2 kg"])
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Menşei", "Türkiye"],
      ["Renk", "Koyu"],
      ["Ağırlık", "1,2 kg"],
    ])
    // Read as a list is: every line a fact, or none of them (a sentence among them)
    expect(descriptionFactsOf(null, ["Renk: Koyu", "Ağırlık: 300 g"])).toHaveLength(2)
    expect(descriptionFactsOf(null, ["Renk: Koyu", "Ağırlık: 300 g", "El yapımı"])).toEqual([])
    expect(descriptionFactsOf(null, null)).toEqual([])
  })

  it("lets a required field the description fills make the template complete", () => {
    const plan = planAttributes(
      [attribute("pa_renk", "renk", ["Açık"])],
      [HOME],
      facts("<p><strong>Ürün Bilgileri</strong></p><p>Menşei: Türkiye</p>")
    )
    expect(plan).toMatchObject({
      template: "ev",
      cells: { renk_tonu: "Açık", mensei: "Türkiye" },
      requiredMissing: false,
    })
  })

  it("gives a product no template from its description alone: its facts wait for the panel", () => {
    const plan = planAttributes(
      [],
      [HOME],
      facts("<ul><li>Renk: Koyu</li><li>Menşei: Türkiye</li></ul>")
    )
    expect(plan).toMatchObject({
      template: null,
      cells: {},
      facts: { written: 0, left: ["Renk", "Menşei"] },
    })
  })

  it("counts the new products' facts and names the labels left, the commonest first", () => {
    const left = (labels: string[]) => ({ cells: {}, written: 1, left: labels })
    const outcome = factsOutcome(
      [
        { source_key: "1", facts: left(["Garanti", "Kutu"]) },
        { source_key: "2", facts: left(["garanti"]) },
        // Moved before: as the shop keeps it now
        { source_key: "3", facts: left(["Kutu"]) },
        { source_key: "4" },
      ],
      new Set(["1", "2", "4"])
    )
    expect(outcome.counts).toEqual({ facts: 2, facts_left: 3 })
    expect(outcome.problems.map((problem) => problem.source_key)).toEqual([
      '"Garanti": 2 ürün',
      '"Kutu": 1 ürün',
    ])
    expect(outcome.problems[0]?.key).toBe("migration.description_facts_left")
  })
})
