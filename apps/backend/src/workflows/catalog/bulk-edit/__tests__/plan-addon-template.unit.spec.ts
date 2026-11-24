import type { AddonTemplateSource, StoredAddon } from "../../../../lib/catalog/addons"
import { planBulkChange } from "../plan"
import type { BulkProduct } from "../products"

const text = (id: string): StoredAddon => ({
  id,
  kind: "text",
  label: id,
  help: null,
  required: false,
  max_quantity: null,
  non_withdrawable: false,
  price: 10,
  text: { max_length: 50, charset: "letters_digits" },
})

const templates = new Map<string, AddonTemplateSource>([
  ["adtpl_a", { id: "adtpl_a", name: "A", addons: [text("a1"), text("a2")] }],
  ["adtpl_b", { id: "adtpl_b", name: "B", addons: [text("b1")] }],
])
const context = { locationId: null, addonTemplates: templates }

const product = (fields: Partial<BulkProduct> = {}): BulkProduct => ({
  id: "prod_1",
  handle: "bicak",
  title: "Bıçak",
  status: "published",
  ...fields,
})

describe("bulk edit: add-on template (adr/0052 Ek 2026-11-23)", () => {
  it("links a template, keeping the ones linked already", () => {
    const plan = planBulkChange(
      product({ addon_templates: [{ id: "adtpl_b" }] }),
      { action: "addon_template", mode: "add", template_id: "adtpl_a" },
      context
    )
    expect(plan).toEqual({
      kind: "write",
      write: { action: "addon_template", mode: "add", template_id: "adtpl_a" },
      diff: { addon_templates: { before: ["adtpl_b"], after: ["adtpl_b", "adtpl_a"] } },
    })
  })

  it("leaves a product already linked as it is", () => {
    const plan = planBulkChange(
      product({ addon_templates: [{ id: "adtpl_a" }] }),
      { action: "addon_template", mode: "add", template_id: "adtpl_a" },
      context
    )
    expect(plan).toEqual({ kind: "unchanged" })
  })

  it("skips a product the template would take past five add-ons", () => {
    const plan = planBulkChange(
      product({
        product_extension: { addons: { items: [text("o1"), text("o2"), text("o3"), text("o4")] } },
      }),
      { action: "addon_template", mode: "add", template_id: "adtpl_a" },
      context
    )
    expect(plan).toEqual({ kind: "skipped", key: "addons.too_many" })
  })

  it("counts the templates its attribute template carries", () => {
    const plan = planBulkChange(
      product({
        product_extension: { addons: { items: [text("o1"), text("o2")] } },
        attribute_template: { addon_template_ids: ["adtpl_a"] },
      }),
      { action: "addon_template", mode: "add", template_id: "adtpl_b" },
      context
    )
    expect(plan.kind).toBe("write")
    const over = planBulkChange(
      product({
        product_extension: { addons: { items: [text("o1"), text("o2"), text("o3")] } },
        attribute_template: { addon_template_ids: ["adtpl_a"] },
      }),
      { action: "addon_template", mode: "add", template_id: "adtpl_b" },
      context
    )
    expect(over).toEqual({ kind: "skipped", key: "addons.too_many" })
  })

  it("unlinks a template; one not linked is unchanged", () => {
    const plan = planBulkChange(
      product({ addon_templates: [{ id: "adtpl_a" }, { id: "adtpl_b" }] }),
      { action: "addon_template", mode: "remove", template_id: "adtpl_a" },
      context
    )
    expect(plan).toEqual({
      kind: "write",
      write: { action: "addon_template", mode: "remove", template_id: "adtpl_a" },
      diff: { addon_templates: { before: ["adtpl_a", "adtpl_b"], after: ["adtpl_b"] } },
    })
    expect(
      planBulkChange(
        product(),
        { action: "addon_template", mode: "remove", template_id: "adtpl_a" },
        context
      )
    ).toEqual({ kind: "unchanged" })
  })
})
