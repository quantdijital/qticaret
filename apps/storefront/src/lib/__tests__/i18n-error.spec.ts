import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { ERROR_MESSAGES, errorT } from "@/lib/i18n/error"

/**
 * The error pages carry their four words on their own (docs/21,
 * 2026-11-06): every page loads them, and the whole dictionary would ride
 * along in every page's script. They must stay the dictionary's words.
 */
const ERROR_PAGES = [
  "../../../../../packages/themes/atolye/src/ErrorPage.tsx",
  "../../app/global-error.tsx",
].map((path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"))

describe("the error pages' words", () => {
  it("are the dictionary's own", () => {
    for (const [key, text] of Object.entries(ERROR_MESSAGES)) {
      expect(text).toBe(t(key))
      expect(errorT(key)).toBe(text)
    }
  })

  it("hold every key the themes' error pages and the global error page ask for", () => {
    const asked = ERROR_PAGES.flatMap((source) =>
      [...source.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1])
    )
    expect(asked.length).toBeGreaterThan(0)
    for (const key of asked) {
      expect(Object.keys(ERROR_MESSAGES)).toContain(key)
    }
  })

  it("are not the whole dictionary: the error pages do not import it", () => {
    for (const path of ["../../app/error.tsx", "../../app/global-error.tsx"]) {
      const source = readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
      expect(source).not.toMatch(/from "@\/lib\/i18n"/)
    }
  })
})
