import { productsOf } from "../../catalog-sheet"
import type { SheetRow } from "../../sheets"
import { categoryKey, migrationRows, migrationSheetHeader, packageOf } from "../sheet"
import type { SourceProduct } from "../types"

const units = { weight: "kg" as const, dimension: "cm" as const }

const product: SourceProduct = {
  source_key: "gid://shopify/Product/1",
  handle: "dokum-tava",
  title: "Döküm tava",
  description: "Ağır döküm gövde.\n\nFırına girer.",
  status: "published",
  categories: [["Mutfak", "Tavalar"], ["Kampanya"]],
  brand: "Örnek",
  seo_title: "Döküm tava | Örnek",
  seo_description: null,
  images: ["https://cdn.example.com/tava.jpg"],
  options: [{ name: "Boyut", values: ["24 cm", "28 cm"] }],
  variants: [
    {
      source_key: "v1",
      sku: "TAVA-24",
      barcode: "8690000000011",
      price: "899.90",
      compare_at_price: null,
      stock: 5,
      options: { Boyut: "24 cm" },
      weight: 1500,
    },
    {
      source_key: "v2",
      sku: "TAVA-28",
      barcode: null,
      price: "1099.90",
      compare_at_price: null,
      stock: 0,
      options: { Boyut: "28 cm" },
      weight: 1900,
    },
  ],
  dimensions: { length: 40, width: 28, height: 8 },
  old_url: "/products/dokum-tava",
}

const handles: Record<string, string> = {
  [categoryKey(["Mutfak", "Tavalar"])]: "tavalar",
  [categoryKey(["Kampanya"])]: "kampanya",
}

describe("source products as the catalog sheet reads them (F14, adr/0042 §2)", () => {
  it("makes one row per variant that the sheet import reads back as the same product", () => {
    const header = migrationSheetHeader(units)
    const rows = migrationRows(product, {
      units,
      categoryHandle: (path) => handles[categoryKey(path)] ?? null,
      brandHandle: (name) => (name === "Örnek" ? "ornek" : null),
      defaults: null,
    })
    // As the import reads a file: every cell text, numbers with a decimal comma as Excel writes
    const read: SheetRow[] = rows.map((cells, index) => ({
      line: index + 2,
      cells: cells.map((cell) =>
        cell === null ? "" : typeof cell === "number" ? String(cell).replace(".", ",") : cell
      ),
    }))

    const { products, problems } = productsOf(header, read)

    expect(problems).toEqual([])
    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      handle: "dokum-tava",
      fields: {
        title: "Döküm tava",
        status: "published",
        categories: ["tavalar", "kampanya"],
        brand: "ornek",
        seo_title: "Döküm tava | Örnek",
        weight: 1.5,
        length: 40,
        width: 28,
        height: 8,
      },
    })
    expect(
      products[0]?.variants.map((variant) => [variant.sku, variant.price, variant.stock])
    ).toEqual([
      ["TAVA-24", 899.9, 5],
      ["TAVA-28", 1099.9, 0],
    ])
  })

  it("leaves out a category or brand the migration could not make, rather than naming another", () => {
    const [first] = migrationRows(
      { ...product, categories: [["Yok"]], brand: "Bilinmeyen" },
      { units, categoryHandle: () => null, brandHandle: () => null, defaults: null }
    )
    const header = migrationSheetHeader(units)

    expect(first?.[header.indexOf("Kategoriler")]).toBeNull()
    expect(first?.[header.indexOf("Marka")]).toBeNull()
  })

  it("fills a parcel from the owner's defaults, else keeps a live product live without one (adr/0054)", () => {
    const bare = {
      ...product,
      dimensions: null,
      variants: product.variants.map((variant) => ({ ...variant, weight: null })),
    }
    const defaults = { weight: 800, length: 30, width: 20, height: 10 }
    const header = migrationSheetHeader({ weight: "g", dimension: "mm" })
    const cell = (row: (string | number | null)[] | undefined, name: string) =>
      row?.[header.findIndex((text) => text.startsWith(name))]
    const refs = {
      units: { weight: "g" as const, dimension: "mm" as const },
      categoryHandle: () => null,
      brandHandle: () => null,
    }

    const [filled] = migrationRows(bare, { ...refs, defaults })
    const [bareRow] = migrationRows(bare, { ...refs, defaults: null })

    expect(packageOf(bare, defaults)).toMatchObject({ defaulted: true, complete: true })
    expect(packageOf(product, defaults)).toMatchObject({ weight: 1500, defaulted: false })
    expect([cell(filled, "Durum"), cell(filled, "Ağırlık"), cell(filled, "Uzunluk")]).toEqual([
      "Yayında",
      800,
      300,
    ])
    expect(packageOf(bare, null).complete).toBe(false)
    expect([cell(bareRow, "Durum"), cell(bareRow, "Ağırlık")]).toEqual(["Yayında", null])
  })
})
