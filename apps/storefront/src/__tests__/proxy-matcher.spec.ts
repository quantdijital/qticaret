import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { FONT_FILES } from "@/app/fonts"
import { SERVED_FILES, isFileName, isStaticFile } from "@/lib/seo/paths"
import { shopMarks } from "@/lib/views/card-extras"
import { config } from "../proxy"

// As Next 16 compiles the matcher (`.next/server/functions-config-manifest.json`): the
// pattern as written, with an optional data prefix and RSC suffix around it
const matcher = new RegExp(
  `^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:${config.matcher[0] ?? ""})(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$`
)
const proxied = (pathname: string) => matcher.test(pathname)

const ROOT = join(__dirname, "..", "..")
const filesIn = (dir: string) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)

describe("the proxy's matcher", () => {
  it("leaves out Next's build files and images only", () => {
    for (const path of ["/_next/static/chunks/main.js", "/_next/image", "/_next/image/x"]) {
      expect(proxied(path)).toBe(false)
    }
  })

  // adr/0053 Ek 2026-11-15: an address the proxy skips falls to a page when no file lives
  // there, and a page runs the root layout's Server Actions posted to it, gate or not
  it("takes every other address, the files' names included: the gate never stands aside", () => {
    for (const path of [
      "/",
      "/urun/keten-gomlek",
      "/favicon.ico",
      "/icon.svg",
      "/apple-icon.png",
      "/manifest.webmanifest",
      "/fonts/inter-latin.c940764593.woff2",
      "/fonts/yok-latin.0123456789.woff2",
      "/marks/visa.png",
      "/marks/bank_transfer.svg",
      "/icon.svg-rehberi",
      "/fonts/rehber",
      "/_next/imagex",
      "/_next/data/x.json",
      "/_next/webpack-hmr",
    ]) {
      expect(proxied(path)).toBe(true)
    }
  })
})

describe("the storefront's files (`isStaticFile`)", () => {
  it("are exactly the files `public/` and the app's metadata files hold", () => {
    const onDisk = [
      ...filesIn("public/fonts").map((name) => `/fonts/${name}`),
      ...filesIn("public/marks")
        .filter((name) => name !== "README.md")
        .map((name) => `/marks/${name}`),
      // Next's metadata file conventions at the app's root
      ...filesIn("src/app")
        .filter((name) =>
          /^(?:favicon\.ico|(?:apple-)?icon\d*\.\w+|manifest\.(?:json|webmanifest))$/.test(name)
        )
        .map((name) => `/${name}`),
    ]
    for (const path of onDisk) {
      expect(isStaticFile(path), path).toBe(true)
      expect(isFileName(path), path).toBe(true)
    }
    // Nothing more: a name listed with no file behind it would fall to the catch-all page
    expect(new Set(SERVED_FILES)).toEqual(new Set(onDisk))
  })

  it("hold every face `fonts.ts` preloads and every mark the footer draws", () => {
    for (const path of Object.values(FONT_FILES).flat()) {
      expect(isStaticFile(path), path).toBe(true)
    }
    const marks = shopMarks(
      ["visa", "mastercard", "troy", "paytr", "iyzico", "aras", "yurtici"],
      (key) => key
    )
    for (const mark of marks) {
      expect(isStaticFile(mark.logo?.src ?? ""), mark.key).toBe(true)
    }
  })

  it("answer a README in `public/marks` as any address: through the gate", () => {
    expect(isFileName("/marks/README.md")).toBe(false)
  })
})
