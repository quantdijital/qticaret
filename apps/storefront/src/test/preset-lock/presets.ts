import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { readPreset } from "@qticaret/sector-packs"
import type { StorefrontPreset } from "@qticaret/sector-packs"

/**
 * What the preset lock covers (docs/tema/bilesen-standardi §7): every
 * preset folder under `packages/sector-packs/packs/<pack>/presets/`, found
 * on disk (no list to keep), each read and checked as the backend reads it
 * (`readPreset`); and every stylesheet of the Atölye theme.
 */

const ROOT = fileURLToPath(new URL("../../../../../", import.meta.url))

export const PACKS_DIR = join(ROOT, "packages/sector-packs/packs")
export const THEME_SOURCE = join(ROOT, "packages/themes/atolye/src")

/** The snapshots' folder, beside the spec. */
export const LOCK_DIR = join(ROOT, "apps/storefront/src/lib/__tests__/preset-lock")

/** Set by `pnpm lock:presets` (with vitest's `-u`): the lock is being written again on purpose. */
export const UPDATING = process.env["PRESET_LOCK"] === "update"

export const UPDATE_HINT =
  "If the change is meant, look at the affected presets in a browser, run `pnpm lock:presets` " +
  "and name the affected presets in the PR body (docs/tema/bilesen-standardi.md §7); " +
  "else draw the new design as a setting or a new variant and leave the published one as it was."

/** A snapshot's header: what it is and what the fixed shop could not give the preset. */
export const header = (key: string, notes: string[]) =>
  [`<!-- preset lock: ${key} (docs/tema/bilesen-standardi.md §7) -->`, ...notes].join("\n") + "\n"

/** What the fixed shop could not give a preset, as its snapshots' header lines say. */
export const fixtureNotes = (answer: { skipped: string[]; dropped: string[] }): string[] => [
  ...answer.skipped.map((each) => `<!-- not in the fixture shop: ${each} -->`),
  ...answer.dropped.map((each) => `<!-- section dropped: ${each} -->`),
]

const folders = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : []

/** Every preset of every pack, by `<pack>-<code>`. */
export function allPresets(): { key: string; preset: StorefrontPreset }[] {
  return folders(PACKS_DIR).flatMap((pack) =>
    folders(join(PACKS_DIR, pack, "presets")).map((code) => ({
      key: `${pack}-${code}`,
      preset: readPreset(join(PACKS_DIR, pack, "presets", code), pack, code),
    }))
  )
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith(".css") ? [path] : []
  })
}

/**
 * Each theme stylesheet's sha256 (line ends made `\n` first) and its path in
 * the theme's `src`, by path. The digest is written before the name: a
 * secret scanner reads `"tokens.css": "<hex>"` as a token.
 */
export function styleDigests(): { sha256: string; file: string }[] {
  return cssFiles(THEME_SOURCE)
    .map((path) => ({
      sha256: createHash("sha256")
        .update(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"))
        .digest("hex"),
      file: relative(THEME_SOURCE, path).split("\\").join("/"),
    }))
    .sort((a, b) => a.file.localeCompare(b.file))
}
