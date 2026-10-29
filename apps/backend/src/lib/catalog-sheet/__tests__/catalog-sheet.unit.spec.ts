import { decimalCell, handleListCell, statusCell, textCell } from "../cells"
import { SHEET_COLUMNS, headerOf, readHeader } from "../columns"
import { productsOf } from "../rows"

const price = (raw: string) =>
  decimalCell(raw, { max: 1e9, decimals: 2, key: "catalog_import.price_invalid" })
const header = SHEET_COLUMNS.map((column) => headerOf(column, { weight: "g", dimension: "cm" }))
const at = (key: string) => SHEET_COLUMNS.findIndex((column) => column.key === key)

/** A row with these columns filled, the rest empty. */
function row(line: number, values: Record<string, string>) {
  const cells = header.map(() => "")
  for (const [key, value] of Object.entries(values)) {
    cells[at(key)] = value
  }
  return { line, cells }
}

describe("sheet header", () => {
  it("knows a column by its words, its key or with another unit, and an attribute by its prefix", () => {
    const read = readHeader([
      "Ağırlık (kg)",
      "seo_title",
      "TANITICI",
      "Özellik: Malzeme",
      "Not",
      "Tanıtıcı",
    ])
    expect(
      read.columns.map((ref) => (ref?.kind === "column" ? ref.spec.key : (ref?.key ?? null)))
    ).toEqual(["weight", "seo_title", "handle", "malzeme", null, null])
    expect([read.unknown, read.repeated]).toEqual([["Not"], ["Tanıtıcı"]])
  })
})

describe("sheet cells", () => {
  it.each([
    ["1.250,50", 1250.5],
    ["1250,5", 1250.5],
    ["1250.5", 1250.5],
    ["1.25", 1.25],
    [" 19 ", 19],
  ])("reads the amount %s", (raw, value) => {
    expect(price(raw)).toEqual({ ok: true, value })
  })

  it.each(["-5", "abc", "1.2.3", "12,345", "1,5.0"])("refuses the amount %s", (raw) => {
    expect(price(raw).ok).toBe(false)
  })

  it("reads statuses, handle lists and text an export escaped", () => {
    expect([statusCell("Yayında"), statusCell("taslak"), statusCell("published")]).toEqual([
      { ok: true, value: "published" },
      { ok: true, value: "draft" },
      { ok: true, value: "published" },
    ])
    expect(statusCell("açık").ok).toBe(false)
    expect(handleListCell("Bicak | mutfak,bicak")).toEqual({ ok: true, value: ["bicak", "mutfak"] })
    expect(handleListCell("bıçak").ok).toBe(false)
    // The sheet reader takes an export's apostrophe off; a cell keeps what it holds
    expect(textCell("'=TOPLA(A1)", 100)).toEqual({ ok: true, value: "'=TOPLA(A1)" })
    expect(textCell("Birinci satır\r\nİkinci", 100, { multiline: true })).toEqual({
      ok: true,
      value: "Birinci satır\nİkinci",
    })
    expect(textCell("Birinci\nİkinci", 100).ok).toBe(false)
    expect(textCell("a\u0000", 100).ok).toBe(false)
  })
})

describe("sheet products", () => {
  it("makes one product of the rows with one handle, its fields from the first row", () => {
    const { products, problems } = productsOf(header, [
      row(2, {
        handle: "tisort",
        title: "Tişört",
        price: "199,90",
        option1_name: "Beden",
        option1_value: "S",
        stock: "4",
        sku: "T-S",
      }),
      row(3, {
        handle: "tisort",
        option1_name: "Beden",
        option1_value: "M",
        price: "199.9",
        sku: "T-M",
      }),
      row(4, { title: "Çelik Tava", status: "Yayında", categories: "mutfak", weight: "1,25" }),
    ])
    expect(problems).toEqual([])
    expect(
      products.map((product) => [product.handle, product.isDerived, product.variants.length])
    ).toEqual([
      ["tisort", false, 2],
      ["celik-tava", true, 1],
    ])
    expect(products[0]?.variants[1]).toEqual({
      line: 3,
      options: [["Beden", "M"]],
      sku: "T-M",
      price: 199.9,
    })
    expect(products[1]?.fields).toEqual({
      title: "Çelik Tava",
      status: "published",
      categories: ["mutfak"],
      weight: 1.25,
    })
  })

  it("reads a unit cost in lira, and refuses one past the product page's bound", () => {
    const { products, problems } = productsOf(header, [
      row(2, { handle: "kupa", title: "Kupa", cost: "42,50" }),
      row(3, { handle: "tava", title: "Tava", cost: "10.000.001" }),
    ])

    expect(products[0]?.variants[0]).toMatchObject({ cost: 42.5 })
    expect(problems.map((problem) => [problem.line, problem.key])).toEqual([
      [3, "catalog_import.cost_invalid"],
    ])
  })

  it("leaves out a product with a problem in any row and says where", () => {
    const { products, problems } = productsOf(header, [
      row(2, { handle: "a", title: "A", option1_name: "Renk", option1_value: "Mavi" }),
      row(3, { handle: "a", title: "Başka", option1_name: "Renk", option1_value: "Mavi" }),
      row(4, { handle: "b", title: "B", option1_name: "Renk" }),
      row(5, { handle: "c", title: "C", sku: "X" }),
      row(6, { handle: "d", title: "D", sku: "x", price: "on" }),
      row(7, { handle: "e", title: "E", option1_name: "Renk", option1_value: "Kırmızı" }),
      row(8, { handle: "e", option1_name: "Beden", option1_value: "S" }),
      row(9, { title: "F" }),
      row(10, { title: "f" }),
      row(11, { handle: "g", title: "G" }),
    ])
    expect(problems.map((problem) => [problem.line, problem.key])).toEqual([
      [3, "catalog_import.product_field_conflict"],
      [3, "catalog_import.variant_repeated"],
      [4, "catalog_import.option_incomplete"],
      [6, "catalog_import.price_invalid"],
      // SKUs are one regardless of case
      [6, "catalog_import.sku_repeated"],
      [8, "catalog_import.options_differ"],
      [10, "catalog_import.handle_repeated"],
    ])
    expect(products.map((product) => product.handle)).toEqual(["c", "g"])
  })

  it("wants a handle or a title column", () => {
    expect(productsOf(["SKU"], [{ line: 2, cells: ["x"] }]).problems).toEqual([
      { line: 1, key: "catalog_import.columns_missing" },
    ])
  })
})
