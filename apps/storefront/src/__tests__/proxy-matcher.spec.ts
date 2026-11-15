import { readFileSync, readdirSync } from "node:fs"
import type { IncomingHttpHeaders } from "node:http"
import { join } from "node:path"
import { extractExportedConstValue } from "next/dist/build/analysis/extract-const-value"
import { parseModule } from "next/dist/build/analysis/parse-module"
import { loadBindings } from "next/dist/build/swc"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { describe, expect, it } from "vitest"
import { FONT_FILES } from "@/app/fonts"
import { SERVED_FILES, isFileName, isStaticFile } from "@/lib/seo/paths"
import { shopMarks } from "@/lib/views/card-extras"
import { config } from "../proxy"

// Next's own matching (`getMiddlewareMatchers` + `getMiddlewareRouteMatcher`), the one its
// router runs on every request: the source compiled as the build compiles it, `has` included
const proxied = (pathname: string, headers: IncomingHttpHeaders = {}) =>
  unstable_doesMiddlewareMatch({ config, url: `http://localhost:8000${pathname}`, headers })

const ROOT = join(__dirname, "..", "..")
const filesIn = (dir: string) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)

describe("the proxy's matcher", () => {
  it("leaves out Next's build files and images when nothing could carry a Server Action", () => {
    for (const path of [
      "/_next/static/chunks/main.js",
      "/_next/static/chunks/a.js",
      "/_next/static/x.js",
      "/_next/image",
      "/_next/image/x",
    ]) {
      expect(proxied(path), path).toBe(false)
      expect(proxied(path, { accept: "*/*", "next-router-prefetch": "1" }), path).toBe(false)
    }
  })

  // adr/0053 Ek 2026-11-15, second review: a build file that is not there falls to the
  // catch-all page, which runs a Server Action posted to it (`server-action-request-meta.js`)
  it("takes a build file's or an image's request that may carry a Server Action", () => {
    for (const path of [
      "/_next/static/x.js",
      "/_next/static/chunks/a.js",
      "/_next/static/",
      "/_next/image",
      "/_next/image/x",
    ]) {
      expect(proxied(path, { "next-action": "7f00aa" }), path).toBe(true)
      for (const type of [
        "multipart/form-data; boundary=x",
        "application/x-www-form-urlencoded",
        "Multipart/Form-Data; boundary=x",
        "text/plain;charset=UTF-8",
      ]) {
        expect(proxied(path, { "content-type": type }), `${path} ${type}`).toBe(true)
      }
    }
  })

  // The build reads `config` from the source, not the module: a value it cannot read is
  // only warned about and the proxy then runs on every request, its matcher gone
  it("is read from the source by the build as written", async () => {
    await loadBindings()
    const source = readFileSync(join(ROOT, "src", "proxy.ts"), "utf8")
    const read = extractExportedConstValue(
      (await parseModule("proxy.ts", source)) as Parameters<typeof extractExportedConstValue>[0],
      "config"
    )
    expect(read).toEqual({ value: config })
  })

  // adr/0053 Ek 2026-11-15: an address the proxy skips falls to a page when no file lives
  // there, and a page runs the root layout's Server Actions posted to it, gate or not
  it("takes every other address, the files' names included: the gate never stands aside", () => {
    for (const path of [
      "/",
      "/urun/keten-gomlek",
      "/onizleme/x",
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
      "/_next/staticx",
      "/_next/data/x.json",
      "/_next/hmr",
      "/%5Fnext/static/x.js",
    ]) {
      expect(proxied(path), path).toBe(true)
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
