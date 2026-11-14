import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { packItemKey, readPack, sectorPack, sectorPacks, summaryOf } from "../index"

const manifest = (code: string, extra: Record<string, unknown> = {}) => ({
  format: "quant-sector-pack",
  code,
  version: 1,
  name: "Deneme",
  description: "Bir deneme paketi.",
  ...extra,
})

describe("the packs in this package (adr/0061 C12)", () => {
  it("all read, the general one among them, each folder named by its code", () => {
    const codes = sectorPacks().map((pack) => pack.code)
    expect(codes).toContain("general")
    expect(codes).toContain("cutlery")
    expect(codes).toEqual([...codes].sort())
  })

  it("sums what each holds for the wizard", () => {
    const general = sectorPack("general")
    expect(general && summaryOf(general).counts).toEqual({
      attribute_templates: 1,
      attributes: 5,
      categories: 0,
      flags: 0,
      seo_templates: 0,
      presets: 1,
    })
    const cutlery = sectorPack("cutlery")
    expect(cutlery && summaryOf(cutlery)).toMatchObject({
      code: "cutlery",
      name: "Bıçak ve çatal-bıçak",
      counts: {
        attribute_templates: 2,
        attributes: 31,
        categories: 16,
        flags: 2,
        seo_templates: 1,
        presets: 0,
      },
    })
  })

  it("knows no pack it does not have", () => {
    expect(sectorPack("yok")).toBeNull()
    expect(sectorPack("__proto__")).toBeNull()
  })

  it("names items the same way every time", () => {
    expect(packItemKey.template("bicak-seti")).toBe("attribute_template:bicak-seti")
    expect(packItemKey.attribute("bicak-seti", "sertlik")).toBe("attribute:bicak-seti/sertlik")
    expect(packItemKey.seo("title_templates", "brand")).toBe("seo:title_templates.brand")
    expect(packItemKey.presetImage("grafit", "images/hero.webp")).toBe(
      "preset_image:grafit/images/hero.webp"
    )
  })
})

describe("a pack's folder", () => {
  let root: string
  const write = (code: string, files: Record<string, unknown>) => {
    const dir = join(root, code)
    mkdirSync(dir, { recursive: true })
    for (const [name, value] of Object.entries(files)) {
      writeFileSync(join(dir, name), typeof value === "string" ? value : JSON.stringify(value))
    }
    return dir
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sector-packs-"))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("reads a manifest alone as an empty pack", () => {
    const dir = write("bos", { "manifest.json": manifest("bos") })
    expect(readPack(dir, "bos")).toMatchObject({
      attribute_templates: [],
      categories: [],
      flags: [],
      seo: {},
      presets: [],
    })
  })

  it.each([
    ["an unknown manifest field", { "manifest.json": manifest("x1", { owner: "platform" }) }],
    ["a manifest of another code", { "manifest.json": manifest("baska") }],
    ["no manifest", { "flags.json": [] }],
    ["a file it does not know", { "manifest.json": manifest("x1"), "notes.json": {} }],
    ["a file named as the presets folder", { "manifest.json": manifest("x1"), presets: "{}" }],
    ["a file that is not JSON", { "manifest.json": manifest("x1"), "flags.json": "{" }],
    [
      "an unknown category field",
      {
        "manifest.json": manifest("x1"),
        "categories.json": [{ handle: "a", name: "A", image: "x.png" }],
      },
    ],
    [
      "a child before its parent",
      {
        "manifest.json": manifest("x1"),
        "categories.json": [
          { handle: "alt", name: "Alt", parent: "ust" },
          { handle: "ust", name: "Üst" },
        ],
      },
    ],
    [
      "a category twice",
      {
        "manifest.json": manifest("x1"),
        "categories.json": [
          { handle: "a", name: "A" },
          { handle: "a", name: "B" },
        ],
      },
    ],
    [
      "an unknown flag field",
      { "manifest.json": manifest("x1"), "flags.json": [{ key: "a.b", enabled: true, x: 1 }] },
    ],
    [
      "a flag twice",
      {
        "manifest.json": manifest("x1"),
        "flags.json": [
          { key: "a.b", enabled: true },
          { key: "a.b", enabled: false },
        ],
      },
    ],
    [
      "an unknown SEO field",
      { "manifest.json": manifest("x1"), "seo.json": { robots_txt: "User-agent: *" } },
    ],
    [
      "a template's attribute twice",
      {
        "manifest.json": manifest("x1"),
        "attributes.json": [
          {
            handle: "t",
            name: "T",
            definitions: [
              { key: "a", label: "A", type: "text" },
              { key: "a", label: "B", type: "text" },
            ],
          },
        ],
      },
    ],
    [
      "a template handle that is no handle",
      {
        "manifest.json": manifest("x1"),
        "attributes.json": [{ handle: "Bıçak", name: "T", definitions: [] }],
      },
    ],
  ])("refuses %s", (_what, files) => {
    const dir = write("x1", files)
    expect(() => readPack(dir, "x1")).toThrow("sector pack:")
  })

  it("refuses a folder whose name is no pack code", () => {
    const dir = write("X_1", { "manifest.json": manifest("X_1") })
    expect(() => readPack(dir, "X_1")).toThrow("is not a pack code")
  })

  it("lists the packs of a folder, refusing the whole list for one bad pack", () => {
    write("b-paket", { "manifest.json": manifest("b-paket") })
    write("a-paket", { "manifest.json": manifest("a-paket") })
    expect(sectorPacks(root).map((pack) => pack.code)).toEqual(["a-paket", "b-paket"])
    const other = mkdtempSync(join(tmpdir(), "sector-packs-"))
    try {
      mkdirSync(join(other, "kotu"))
      expect(() => sectorPacks(other)).toThrow("has no manifest.json")
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })
})
