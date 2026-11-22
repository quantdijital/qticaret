import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { packItemKey, readPack, sectorPack, sectorPacks } from "../index"

/** A pack's catalog defaults and draft pages (adr/0076 §12), and the travel pack built on them. */

const manifest = (code: string) => ({
  format: "quant-sector-pack",
  code,
  version: 1,
  name: "Deneme",
  description: "Bir deneme paketi.",
})

const doc = { type: "doc", content: [{ type: "paragraph" }] }

describe("the travel pack (adr/0076 §12)", () => {
  const travel = sectorPack("travel")

  it("is read with the others", () => {
    expect(sectorPacks().map((pack) => pack.code)).toContain("travel")
    expect(travel).not.toBeNull()
  })

  it("turns on non-physical products before dated selling, which needs them", () => {
    expect(travel?.flags).toEqual([
      { key: "catalog.non_physical", enabled: true },
      { key: "catalog.booking", enabled: true },
    ])
  })

  it("starts a new product as a dated service and names its structured data", () => {
    expect(travel?.catalog).toEqual({
      new_product: { kind: "service", booking_mode: "departure" },
      dated_schema_type: "TouristTrip",
    })
  })

  it("offers the trip's facts as one template", () => {
    expect(travel?.attribute_templates.map((template) => template.handle)).toEqual([
      "tur-bilgileri",
    ])
    expect(travel?.attribute_templates[0]?.definitions.map((each) => each.key)).toEqual([
      "sure",
      "kalkis_yeri",
      "dahil_olanlar",
      "dahil_olmayanlar",
      "vize_pasaport_notu",
    ])
  })

  it("offers its cancellation terms as one page", () => {
    expect(travel?.pages?.map((page) => page.handle)).toEqual(["iptal-kosullari"])
    expect(travel?.pages?.[0]?.body.type).toBe("doc")
  })

  it("has no storefront preset: none is built for it yet", () => {
    expect(travel?.presets).toEqual([])
  })

  it("leaves the other packs' defaults and pages empty", () => {
    expect(sectorPack("cutlery")?.catalog).toEqual({})
    expect(sectorPack("general")?.pages).toEqual([])
  })

  it("names the new items the same way every time", () => {
    expect(packItemKey.page("iptal-kosullari")).toBe("page:iptal-kosullari")
    expect(packItemKey.setting("catalog", "new_product_kind")).toBe(
      "setting:catalog.new_product_kind"
    )
  })
})

describe("a pack's catalog.json and pages.json", () => {
  let root: string
  const write = (code: string, files: Record<string, unknown>) => {
    const dir = join(root, code)
    mkdirSync(dir, { recursive: true })
    for (const [name, value] of Object.entries(files)) {
      writeFileSync(join(dir, name), JSON.stringify(value))
    }
    return dir
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sector-packs-"))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("reads both", () => {
    const dir = write("x1", {
      "manifest.json": manifest("x1"),
      "catalog.json": { new_product: { kind: "digital", booking_mode: "none" } },
      "pages.json": [{ handle: "kosullar", title: "Koşullar", body: doc }],
    })
    expect(readPack(dir, "x1")).toMatchObject({
      catalog: { new_product: { kind: "digital", booking_mode: "none" } },
      pages: [{ handle: "kosullar", title: "Koşullar", body: doc }],
    })
  })

  it.each([
    [
      "a dated product that is no service",
      { new_product: { kind: "physical", booking_mode: "departure" } },
    ],
    ["a booking mode not written yet", { new_product: { kind: "service", booking_mode: "range" } }],
    ["an unknown kind", { new_product: { kind: "rental", booking_mode: "none" } }],
    ["an unknown structured data type", { dated_schema_type: "Product" }],
    ["an unknown field", { theme: "atolye" }],
  ])("refuses catalog.json with %s", (_what, catalog) => {
    const dir = write("x1", { "manifest.json": manifest("x1"), "catalog.json": catalog })
    expect(() => readPack(dir, "x1")).toThrow()
  })

  it.each([
    [
      "a page twice",
      [
        { handle: "a", title: "A", body: doc },
        { handle: "a", title: "B", body: doc },
      ],
    ],
    ["a handle that is no handle", [{ handle: "İptal", title: "A", body: doc }]],
    ["a body that is no document", [{ handle: "a", title: "A", body: { type: "html" } }]],
    ["an unknown field", [{ handle: "a", title: "A", body: doc, status: "published" }]],
  ])("refuses pages.json with %s", (_what, pages) => {
    const dir = write("x1", { "manifest.json": manifest("x1"), "pages.json": pages })
    expect(() => readPack(dir, "x1")).toThrow()
  })
})
