import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readPack, readPreset } from "../index"
import { MAX_JSON_BYTES } from "../read-json"

/**
 * The frame's edges (adr/0063 §7): only the frame's names in a folder,
 * hidden ones included; JSON files of a bounded size; and no address in a
 * rich text that a `$href` or `$image` would not allow.
 */

const PRESET = {
  format: "quant-storefront-preset",
  code: "x1",
  version: 1,
  theme: "atolye",
  name: "Deneme",
  description: "Bir deneme görünümü.",
  tone: "dark",
}
const THEME = { theme: "atolye", radius: "soft" }

const doc = (node: Record<string, unknown>) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [node] }],
})
const linked = (href: unknown) =>
  doc({ type: "text", text: "Çakılar", marks: [{ type: "link", attrs: { href } }] })
const richText = (body: unknown) => ({ home: [{ id: "metin1", type: "rich_text", body }] })

let root: string
const write = (files: Record<string, unknown>, code = "x1") => {
  const dir = join(root, "presets", code)
  mkdirSync(join(dir, "images"), { recursive: true })
  const all = { "preset.json": PRESET, "theme.json": THEME, "layout.json": { home: [] }, ...files }
  for (const [name, value] of Object.entries(all)) {
    writeFileSync(join(dir, name), typeof value === "string" ? value : JSON.stringify(value))
  }
  return dir
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sector-preset-frame-"))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("a preset's folder holds the frame's names only", () => {
  it.each([
    ["the preset's folder", ".DS_Store", "deneme/presets/x1/.DS_Store is a hidden file"],
    ["its images", "images/.gizli.webp", "deneme/presets/x1/images/.gizli.webp is a hidden file"],
  ])("refuses a hidden file in %s, naming it", (_where, name, message) => {
    const dir = write({ [name]: "x" })
    expect(() => readPreset(dir, "deneme", "x1")).toThrow(message)
  })

  it("refuses a hidden file among the presets and in the pack's folder", () => {
    const manifest = {
      format: "quant-sector-pack",
      code: "deneme",
      version: 1,
      name: "Deneme",
      description: "Bir deneme paketi.",
    }
    writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest))
    write({})
    expect(readPack(root, "deneme").presets.map((each) => each.code)).toEqual(["x1"])
    writeFileSync(join(root, "presets", ".DS_Store"), "x")
    expect(() => readPack(root, "deneme")).toThrow("deneme/presets/.DS_Store is a hidden file")
    rmSync(join(root, "presets"), { recursive: true })
    writeFileSync(join(root, ".DS_Store"), "x")
    expect(() => readPack(root, "deneme")).toThrow("deneme/.DS_Store is not a pack file")
  })
})

describe("a preset's JSON files", () => {
  it("refuses one over the size limit before reading it", () => {
    const big = `{"home":[],"x":"${"a".repeat(MAX_JSON_BYTES)}"}`
    const dir = write({ "layout.json": big })
    expect(() => readPreset(dir, "deneme", "x1")).toThrow(
      `deneme/presets/x1/layout.json is over ${String(MAX_JSON_BYTES)} bytes`
    )
  })
})

describe("a rich text in a preset's design", () => {
  it("takes a link to a shop path or an https address", () => {
    const dir = write({
      "layout.json": {
        home: [
          { id: "metin1", type: "rich_text", body: linked("/cakilar") },
          { id: "metin2", type: "rich_text", body: linked("https://ornek.com.tr/kilavuz") },
        ],
      },
    })
    expect(readPreset(dir, "deneme", "x1").layout.home).toHaveLength(2)
  })

  it.each([
    ["an address that leaves the shop", linked("//kotu.example/a"), "attrs.href"],
    ["a plain http address", linked("http://kotu.example/a"), "attrs.href"],
    ["a script address", linked("javascript:alert(1)"), "attrs.href"],
    ["an address that is no text", linked({ url: "/a" }), "attrs.href"],
    [
      "an image by its address",
      doc({ type: "image", attrs: { src: "https://kotu.example/a.webp" } }),
      "attrs.src",
    ],
  ])("refuses %s", (_what, body, message) => {
    const dir = write({ "layout.json": richText(body) })
    expect(() => readPreset(dir, "deneme", "x1")).toThrow(message)
  })
})

describe("the fields a preset writes for a shop it does not know", () => {
  it("takes category icons by handle and a non-catalog header's action button", () => {
    const icons = {
      id: "ikonsira01",
      type: "categories",
      variant: "icons",
      category_icons_by_handle: { "dag-turlari": "mountain", plaj: "palm" },
    }
    const header = {
      id: "mainheader",
      type: "header_bar",
      variant: "standard",
      highlight_link: { $href: "/rezervasyon", label: "Rezervasyon" },
    }
    const dir = write({ "layout.json": { header: [header], home: [icons] } })
    const read = readPreset(dir, "deneme", "x1")
    expect(read.layout.home).toEqual([icons])
    expect(read.layout.header).toEqual([header])
  })
})
