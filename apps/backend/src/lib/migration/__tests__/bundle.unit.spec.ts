import { isValidationError } from "../../errors"
import { BUNDLE_FORMAT, bundleSource } from "../sources/bundle"
import type { MigrationSource } from "../types"

const fileOf = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8")

const product = {
  source_key: "p1",
  handle: "dokum-tava",
  title: "Döküm Tava",
  status: "published",
  variants: [{ source_key: "v1", price: "1299.90", options: {} }],
}

const listed = async <T>(items: AsyncIterable<T>): Promise<T[]> => {
  const all: T[] = []
  for await (const item of items) {
    all.push(item)
  }
  return all
}

const refusal = (value: unknown) => {
  try {
    bundleSource(fileOf(value))
  } catch (error) {
    return isValidationError(error) ? { key: error.safeMessage, field: error.field } : error
  }
  return null
}

describe("migration bundle", () => {
  it("reads the common records, filling what a bundle may leave out", async () => {
    const source: MigrationSource = bundleSource(
      fileOf({
        format: BUNDLE_FORMAT,
        version: 1,
        products: [product],
        customers: [
          {
            source_key: "c1",
            email: "ayse@example.com",
            marketing: { email: "2025-03-01T10:00:00+03:00" },
          },
        ],
      })
    )
    const [read] = await listed(source.products())
    expect(read).toMatchObject({
      handle: "dokum-tava",
      description: null,
      categories: [],
      images: [],
      old_url: null,
      variants: [{ sku: null, compare_at_price: null, stock: null, weight: null }],
    })
    const [customer] = await listed(source.customers())
    expect(customer?.marketing).toEqual({ email: new Date("2025-03-01T07:00:00Z"), sms: null })
    expect(await listed(source.orders())).toEqual([])
  })

  it("refuses another format, naming where it breaks", () => {
    expect(refusal({ format: "other", version: 1 })).toMatchObject({
      key: "migration.bundle_invalid",
      field: "format",
    })
    expect(
      refusal({
        format: BUNDLE_FORMAT,
        version: 1,
        products: [{ ...product, variants: [{ source_key: "v1", price: "12,50" }] }],
      })
    ).toMatchObject({ field: "products.0.variants.0.price" })
    expect(refusal({ format: BUNDLE_FORMAT, version: 1, unknown: [] })).toMatchObject({
      key: "migration.bundle_invalid",
    })
    expect(bundleSourceOf("not json")).toMatchObject({ key: "migration.bundle_invalid" })
  })

  it("takes old addresses only as paths of the old site, and pictures only over http(s)", () => {
    const withProduct = (changes: Record<string, unknown>) =>
      refusal({ format: BUNDLE_FORMAT, version: 1, products: [{ ...product, ...changes }] })
    expect(withProduct({ old_url: "/urun/dokum-tava?renk=siyah" })).toBeNull()
    expect(withProduct({ old_url: "//evil.example/x" })).toMatchObject({
      field: "products.0.old_url",
    })
    expect(withProduct({ old_url: "https://evil.example/x" })).toMatchObject({
      field: "products.0.old_url",
    })
    expect(withProduct({ images: ["javascript:alert(1)"] })).toMatchObject({
      field: "products.0.images.0",
    })
    expect(withProduct({ images: ["file:///etc/passwd"] })).toMatchObject({
      field: "products.0.images.0",
    })
  })
})

function bundleSourceOf(text: string) {
  try {
    bundleSource(Buffer.from(text, "utf8"))
  } catch (error) {
    return isValidationError(error) ? { key: error.safeMessage } : error
  }
  return null
}
