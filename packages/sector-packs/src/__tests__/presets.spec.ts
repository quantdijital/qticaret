import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PRESET_LIMITS, readPack, readPreset } from "../index"

const preset = (code: string, extra: Record<string, unknown> = {}) => ({
  format: "quant-storefront-preset",
  code,
  version: 1,
  theme: "atolye",
  name: "Deneme",
  description: "Bir deneme görünümü.",
  tone: "dark",
  ...extra,
})

const section = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "hero",
  ...extra,
})
const THEME = { theme: "atolye", radius: "soft" }

/** A file of this type and size, with its type's first bytes. */
const image = (type: "webp" | "jpg" | "png", size = 64): Buffer => {
  const bytes = Buffer.alloc(size)
  const header = {
    webp: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]),
    jpg: Buffer.from("ffd8ffe0", "hex"),
    png: Buffer.from("89504e470d0a1a0a", "hex"),
  }[type]
  header.copy(bytes)
  return bytes
}

const credit = (file: string) => ({ file, source: "Mağaza sahibi", license: "Sahibin izniyle" })

describe("a preset's folder", () => {
  let root: string
  const write = (code: string, files: Record<string, unknown>) => {
    const dir = join(root, "presets", code)
    mkdirSync(join(dir, "images"), { recursive: true })
    for (const [name, value] of Object.entries(files)) {
      const content =
        typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)
      writeFileSync(join(dir, name), content)
    }
    return dir
  }
  const minimal = (code: string, extra: Record<string, unknown> = {}) => ({
    "preset.json": preset(code),
    "theme.json": THEME,
    "layout.json": { home: [section("girisbolumu")] },
    ...extra,
  })
  const withHero = (path: string) => ({
    home: [section("girisbolumu", { image: { $image: path, alt: "Atölye" } })],
  })
  const refused = (files: Record<string, unknown>, message: string, code = "x1") => {
    const dir = write(code, files)
    expect(() => readPreset(dir, "deneme", code)).toThrow(message)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sector-presets-"))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("reads the three required files, references and images", () => {
    const dir = write(
      "koyu-sert",
      minimal("koyu-sert", {
        "preset.json": preset("koyu-sert", { credits: [credit("images/hero.webp")] }),
        "layout.json": {
          home: [
            section("girisbolumu", {
              image: { $image: "images/hero.webp", alt: "Atölye" },
              links: [
                { $href: "/cakilar", label: "Çakılar" },
                { $href: "https://a.example/b", label: "Dış" },
              ],
              // A path on the shop takes the wording of what it resolves to
              more: { $href: "/magaza" },
            }),
            section("kategoriler", {
              type: "categories",
              category_ids: [{ $handle: "category:cakilar" }, { $handle: "category:av" }],
            }),
            section("onecikan1", {
              type: "featured_product",
              product_id: { $handle: "product:a" },
            }),
          ],
        },
        "menus.json": [
          { title: "Ana menü", location: "main", items: [{ label: "Çakılar", href: "/cakilar" }] },
        ],
        "images/hero.webp": image("webp"),
        "preview.webp": image("webp"),
      })
    )
    expect(readPreset(dir, "deneme", "koyu-sert")).toMatchObject({
      pack: "deneme",
      code: "koyu-sert",
      tone: "dark",
      images: [{ path: "images/hero.webp", bytes: 64 }],
      preview: "preview.webp",
      handles: ["category:av", "category:cakilar", "product:a"],
      menus: [{ title: "Ana menü" }],
    })
  })

  it("is read with its pack, and counted for the wizard", () => {
    writeFileSync(
      join(root, "manifest.json"),
      JSON.stringify({
        format: "quant-sector-pack",
        code: "deneme",
        version: 1,
        name: "Deneme",
        description: "Deneme paketi.",
      })
    )
    write("acik-temiz", minimal("acik-temiz"))
    expect(readPack(root, "deneme").presets.map((each) => each.code)).toEqual(["acik-temiz"])
    writeFileSync(join(root, "presets", "notlar.txt"), "x")
    expect(() => readPack(root, "deneme")).toThrow("is not a preset folder")
  })

  it.each([
    ["no theme.json", { "theme.json": undefined }, "has no theme.json"],
    ["an unknown manifest field", { "preset.json": preset("x1", { owner: "x" }) }, "preset.json"],
    ["a manifest of another code", { "preset.json": preset("baska") }, "names baska"],
    ["another format", { "preset.json": preset("x1", { format: "x" }) }, "preset.json format"],
    ["a tone it does not know", { "preset.json": preset("x1", { tone: "grey" }) }, "tone"],
    ["a theme of another theme", { "theme.json": { theme: "baska" } }, "is for baska"],
    ["a file it does not know", { "notes.json": {} }, "is not a preset file"],
    ["a script", { "theme.js": "alert(1)" }, "is not a preset file"],
    ["a file that is not JSON", { "layout.json": "{" }, "is not JSON"],
    ["layout settings", { "layout.json": { settings: {} } }, "layout.json"],
    ["a group it does not know", { "layout.json": { sidebar: [] } }, "layout.json"],
    ["a section without an id", { "layout.json": { home: [{ type: "hero" }] } }, "home.0.id"],
    [
      "a section id twice",
      { "layout.json": { home: [section("ayniid"), section("ayniid", { type: "faq" })] } },
      "section ayniid twice",
    ],
    ["an empty menu set", { "menus.json": [] }, "menus.json"],
    [
      "a menu link that is no address",
      {
        "menus.json": [
          {
            title: "Alt",
            location: "footer",
            items: [{ label: "X", href: "javascript:alert(1)" }],
          },
        ],
      },
      "menus.json 0.items.0.href",
    ],
    ["a demo kind it does not know", { "demo.json": { orders: [] } }, "demo.json"],
  ])("refuses %s", (_what, extra, message) => {
    const files = Object.fromEntries(
      Object.entries<unknown>(minimal("x1", extra)).filter(([, value]) => value !== undefined)
    )
    refused(files, message)
  })

  it.each([
    ["a record id", { category_ids: ["pcat_01JABCDEFGHJKMNPQRSTVWXYZ0"] }, "category_ids"],
    ["a handle of no kind", { category_ids: [{ $handle: "tag:av" }] }, "category_ids.0"],
    [
      "a handle that is no handle",
      { category_ids: [{ $handle: "category:Av Bıçağı" }] },
      "$handle",
    ],
    ["a handle of another kind", { category_ids: [{ $handle: "brand:av" }] }, "category_ids.0"],
    ["a single handle for a list", { category_ids: { $handle: "category:av" } }, "category_ids"],
    ["a field of no record", { post_id: { $handle: "page:a" } }, "post_id"],
    ["a reference it does not know", { image: { $file: "images/a.webp" } }, "$file is no"],
    ["an extra reference field", { more: { $href: "/a", label: "A", kind: "x" } }, "more"],
    ["a link to a record", { more: { kind: "category", target: "pcat_1", label: null } }, "target"],
    ["a media address", { image: { url: "https://cdn.example/a.webp", alt: null } }, "image.url"],
    ["an address that leaves the shop", { more: { $href: "//kotu.example/a" } }, "more.$href"],
    ["a plain http address", { more: { $href: "http://kotu.example/a" } }, "more.$href"],
    [
      "an https address without its label",
      { more: { $href: "https://a.example/b" } },
      "more.label",
    ],
    [
      "an https address with a null label",
      { more: { $href: "https://a.example/b", label: null } },
      "more.label",
    ],
    ["an image outside images/", { image: { $image: "../../manifest.json" } }, "image.$image"],
    ["an image in a subfolder", { image: { $image: "images/a/b.webp" } }, "image.$image"],
    ["an image of another type", { image: { $image: "images/a.svg" } }, "image.$image"],
  ])("refuses %s in the design", (_what, fields, message) => {
    refused(minimal("x1", { "layout.json": { home: [section("girisbolumu", fields)] } }), message)
  })

  it("refuses a demo record that names a category by id", () => {
    refused(
      minimal("x1", { "demo.json": { products: [{ title: "A", category_ids: ["pcat_x"] }] } }),
      "demo.json products.0.category_ids.0"
    )
  })

  it.each([
    ["an image the design names but the folder lacks", {}, "has no images/hero.webp"],
    [
      "an image used nowhere",
      { "images/hero.webp": image("webp"), "images/yedek.webp": image("webp") },
      "images/yedek.webp is used nowhere",
    ],
    ["an image without a credit", { "images/hero.webp": image("webp"), credits: [] }, "no credit"],
    [
      "a credit twice",
      {
        "images/hero.webp": image("webp"),
        credits: [credit("images/hero.webp"), credit("images/hero.webp")],
      },
      "credits images/hero.webp twice",
    ],
    ["an image that is not its type", { "images/hero.webp": image("png") }, "is not a webp image"],
    [
      "an image over the size limit",
      { "images/hero.webp": image("webp", PRESET_LIMITS.imageBytes + 1) },
      "is over",
    ],
  ])("refuses %s", (_what, extra, message) => {
    const { credits, ...files } = extra as Record<string, unknown>
    refused(
      minimal("x1", {
        "preset.json": preset("x1", { credits: credits ?? [credit("images/hero.webp")] }),
        "layout.json": withHero("images/hero.webp"),
        ...files,
      }),
      message
    )
  })

  it("takes a jpg and a png, and refuses more images than the limit", () => {
    const ok = write(
      "iki",
      minimal("iki", {
        "preset.json": preset("iki", { credits: [credit("images/a.jpg"), credit("images/b.png")] }),
        "layout.json": {
          home: [
            section("girisbolumu", { image: { $image: "images/a.jpg" } }),
            section("ikincigiris", { image: { $image: "images/b.png" } }),
          ],
        },
        "images/a.jpg": image("jpg"),
        "images/b.png": image("png"),
      })
    )
    expect(readPreset(ok, "deneme", "iki").images.map((each) => each.path)).toEqual([
      "images/a.jpg",
      "images/b.png",
    ])
    const many: Record<string, unknown> = {}
    for (let index = 0; index <= PRESET_LIMITS.images; index += 1) {
      many[`images/g${String(index)}.webp`] = image("webp")
    }
    refused(minimal("x1", many), `over ${String(PRESET_LIMITS.images)} images`)
  })

  it("refuses an image name the frame does not allow, a big preview and a link", () => {
    refused(minimal("x1", { "images/Büyük Resim.webp": image("webp") }), "is not a preset image")
    refused(
      minimal("x3", { "preview.webp": image("webp", PRESET_LIMITS.previewBytes + 1) }),
      "preview.webp is over",
      "x3"
    )
    const dir = write("x2", minimal("x2"))
    symlinkSync(join(dir, "theme.json"), join(dir, "images", "baglanti.webp"))
    expect(() => readPreset(dir, "deneme", "x2")).toThrow("is a link")
  })

  it("reads a colour family and its colour's name, none as null (adr/0064 Ek 2026-11-17)", () => {
    const plain = readPreset(write("x1", minimal("x1")), "deneme", "x1")
    expect(plain).toMatchObject({ family: null, swatch: null })
    const sibling = readPreset(
      write(
        "x2",
        minimal("x2", {
          "preset.json": preset("x2", { family: "x1", swatch: "Lacivert ve çelik" }),
        })
      ),
      "deneme",
      "x2"
    )
    expect(sibling).toMatchObject({ family: "x1", swatch: "Lacivert ve çelik" })
  })

  it("refuses a family that is no preset code and a colour name past 40 characters", () => {
    refused(
      minimal("x1", { "preset.json": preset("x1", { family: "../x" }) }),
      "preset.json family"
    )
    refused(
      minimal("x1", { "preset.json": preset("x1", { swatch: "x".repeat(41) }) }),
      "preset.json swatch"
    )
  })

  it("refuses a folder whose name is no preset code", () => {
    const dir = write("X_1", minimal("X_1"))
    expect(() => readPreset(dir, "deneme", "X_1")).toThrow("is not a preset code")
  })
})
