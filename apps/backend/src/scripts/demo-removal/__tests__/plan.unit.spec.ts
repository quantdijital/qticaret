import { demoRemovalMode, describeDemoPlan, orderedProductsMode } from "../plan"
import type { DemoRemovalPlan } from "../plan"

const plan: DemoRemovalPlan = {
  orders: [{ id: "order_1", line_item_ids: ["ordli_1", "ordli_2"] }],
  products: [{ id: "prod_1", label: "seramik-kupa" }],
  categories: [{ id: "pcat_1", label: "ev-ve-yasam" }],
  categoriesKept: ["giyim"],
  shippingOptions: [{ id: "so_1", label: "Standart Kargo" }],
  shippingOptionsKeptForCheckout: 0,
  warehouses: [{ id: "sloc_1", label: "Ana Depo" }],
  e2eStaff: [{ id: "user_1", label: "e2e" }],
  importChecks: [{ id: "ajob_1", label: "catalog.import", requested_by: "user_1" }],
  skipped: [{ kind: "product", label: "keten-gomlek" }],
}

describe("demo:remove's plan", () => {
  it("removes at once on a developer's machine", () => {
    expect(demoRemovalMode(true, [])).toBe("remove")
  })

  it("elsewhere reads only when allowed, lists and stops, and removes only when confirmed", () => {
    expect(demoRemovalMode(false, [])).toBe("refuse")
    expect(demoRemovalMode(false, ["confirm"])).toBe("refuse")
    expect(demoRemovalMode(false, ["allow-non-local"])).toBe("list_only")
    expect(demoRemovalMode(false, ["allow-non-local", "confirm"])).toBe("remove")
    expect(demoRemovalMode(false, ["allow-non-local", "--confirm"])).toBe("list_only")
  })

  it("takes the seed products orders hold only when asked, and on a developer's machine only", () => {
    expect(orderedProductsMode(true, [])).toBe("skip")
    expect(orderedProductsMode(true, ["products-with-orders"])).toBe("remove")
    expect(orderedProductsMode(false, ["products-with-orders"])).toBe("refuse")
    expect(orderedProductsMode(false, ["products-with-orders", "allow-non-local", "confirm"])).toBe(
      "refuse"
    )
    expect(orderedProductsMode(false, ["allow-non-local", "confirm"])).toBe("skip")
    // `medusa exec` passes plain words only: the dashed form is not the option
    expect(orderedProductsMode(true, ["--products-with-orders"])).toBe("skip")
  })

  it("lists every record it would remove, one line each, and nothing it keeps", () => {
    const lines = describeDemoPlan(plan)

    expect(lines.map((line) => `${line.kind}:${line.id}`)).toEqual([
      "order:order_1",
      "product:prod_1",
      "category:pcat_1",
      "shipping_option:so_1",
      "warehouse_address:sloc_1",
      "e2e_staff:user_1",
      "import_check:ajob_1",
    ])
    expect(lines.find((line) => line.kind === "order")?.label).toBe("2 line items")
    expect(JSON.stringify(lines)).not.toContain("keten-gomlek")
    expect(JSON.stringify(lines)).not.toContain("giyim")
  })
})
