import { describe, expect, it } from "vitest"
import { isStaticFile } from "@/lib/seo/paths"
import { config } from "../proxy"

// As Next 16 compiles the matcher (`.next/server/functions-config-manifest.json`): the
// pattern as written, with an optional data prefix and RSC suffix around it
const matcher = new RegExp(
  `^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:${config.matcher[0] ?? ""})(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$`
)
const proxied = (pathname: string) => matcher.test(pathname)

describe("the proxy's matcher", () => {
  it("leaves out Next's build files, the metadata files and the faces: no resolve, no 404 report", () => {
    for (const path of [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/icon.svg",
      "/apple-icon.png",
      "/manifest.webmanifest",
      "/fonts/inter-latin.c940764593.woff2",
      "/fonts/fraunces-tr.001f80ce8b.woff2",
    ]) {
      expect(proxied(path)).toBe(false)
    }
  })

  it("still takes every page, those that only start or end like a file included", () => {
    for (const path of [
      "/",
      "/urun/keten-gomlek",
      "/icon.svg-rehberi",
      "/icon.svgx",
      "/apple-icon.png/x",
      "/manifest.webmanifest.html",
      "/favicon.icon",
      "/fonts",
      "/fonts/rehber",
      "/fonts/inter.woff2",
      "/kategori/icon.svg",
      "/_next/imagex",
    ]) {
      expect(proxied(path)).toBe(true)
    }
  })

  it("agrees with the proxy's own static file check", () => {
    for (const path of [
      "/icon.svg",
      "/apple-icon.png",
      "/manifest.webmanifest",
      "/favicon.ico",
      "/fonts/nunito-latin.20fc9b6fc6.woff2",
      "/icon.svgx",
      "/fonts/inter.woff2",
      "/magaza",
    ]) {
      expect(proxied(path)).toBe(!isStaticFile(path))
    }
  })
})
