import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_PACKS_DIR, readSamples, sectorPack } from "../index"

/**
 * A pack's sample catalogue (owner, 2026-11-28): one set per sector, the
 * travel pack's tours finding the handles its looks lean on; the frame
 * refuses what it cannot load safely.
 */

const LOOK_HANDLES = [
  "kapadokya-turlari",
  "ege-ve-akdeniz-turlari",
  "doga-ve-trekking",
  "kultur-turlari",
  "gunubirlik-turlar",
  "gemi-turlari",
  "yurt-disi-turlar",
]

describe("the travel pack's sample tours", () => {
  const samples = sectorPack("travel")?.samples
  const products = samples?.products ?? []

  it("are 8 to 12 dated tours with pictures, prices, departures, a program and reviews", () => {
    expect(products.length).toBeGreaterThanOrEqual(8)
    expect(products.length).toBeLessThanOrEqual(12)
    for (const product of products) {
      expect(product.images.length).toBeGreaterThan(0)
      expect(product.summary).toBeTruthy()
      expect(product.description.length).toBeGreaterThan(product.summary?.length ?? 0)
      expect(product.variants.map((variant) => variant.options["Kişi"])).toEqual([
        "Yetişkin",
        "Çocuk",
      ])
      expect(product.booking?.departures.length).toBeGreaterThan(0)
      expect(product.booking?.program?.steps.length).toBeGreaterThan(0)
      expect(product.reviews.length).toBeGreaterThan(0)
    }
  })

  it("fill every category the travel looks show", () => {
    const filled = new Set(products.flatMap((product) => product.categories))
    for (const handle of LOOK_HANDLES) {
      expect(filled.has(handle)).toBe(true)
    }
  })

  it("credit every picture with a Commons source and a free licence", () => {
    for (const credit of samples?.credits ?? []) {
      expect(credit.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
      expect(credit.license).toMatch(/^(CC0|CC BY(-SA)? \d\.\d)/)
    }
  })

  it("is none for a pack without a samples folder", () => {
    expect(sectorPack("general")?.samples ?? null).toBeNull()
  })
})

describe("the samples frame", () => {
  let root: string
  const image = join(
    DEFAULT_PACKS_DIR,
    "travel",
    "samples",
    "images",
    "mardin-midyat-gap-turu-1.webp"
  )
  const PRODUCT = {
    handle: "tur-1",
    title: "Tur",
    description: "Uzun açıklama.",
    categories: ["kultur"],
    options: [{ title: "Kişi", values: ["Yetişkin"] }],
    variants: [{ options: { Kişi: "Yetişkin" }, price: 100 }],
    images: ["images/tur-1.webp"],
  }
  const write = (data: Record<string, unknown>, extra?: (dir: string) => void) => {
    const dir = join(root, "samples")
    mkdirSync(join(dir, "images"), { recursive: true })
    copyFileSync(image, join(dir, "images", "tur-1.webp"))
    writeFileSync(
      join(dir, "samples.json"),
      JSON.stringify({
        format: "quant-sample-catalog",
        version: 1,
        name: "Örnekler",
        products: [PRODUCT],
        credits: [{ file: "images/tur-1.webp", source: "https://x", license: "CC0" }],
        ...data,
      })
    )
    extra?.(dir)
  }
  const read = () => readSamples(root, "x", new Set(["kultur"]))

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sector-samples-"))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("reads a well-formed set", () => {
    write({})
    expect(read()?.products).toHaveLength(1)
  })

  it("refuses a product in a category neither the set nor the pack has", () => {
    write({ products: [{ ...PRODUCT, categories: ["yok"] }] })
    expect(read).toThrow(/unknown category yok/)
  })

  it("refuses a picture without a credit", () => {
    write({ credits: [] })
    expect(read).toThrow(/has no credit/)
  })

  it("refuses a stray file and an unused picture", () => {
    write({}, (dir) => {
      writeFileSync(join(dir, "notes.txt"), "x")
    })
    expect(read).toThrow(/not a samples file/)
    rmSync(join(root, "samples", "notes.txt"))
    copyFileSync(image, join(root, "samples", "images", "fazla.webp"))
    expect(read).toThrow(/fazla\.webp is not used/)
  })

  it("refuses a variant whose option value the product does not offer", () => {
    write({ products: [{ ...PRODUCT, variants: [{ options: { Kişi: "Bebek" }, price: 1 }] }] })
    expect(read).toThrow(/has no "Kişi"/)
  })
})
