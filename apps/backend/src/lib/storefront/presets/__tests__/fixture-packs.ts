import { join } from "node:path"
import { storefrontPreset } from "@qticaret/sector-packs"
import type { StorefrontPreset } from "@qticaret/sector-packs"

/**
 * The tests' own packs folder: a `general` pack with one ready-made look,
 * `sade` (no header of its own; a hero, categories, the newest products,
 * a help box and posts on the home page; a newsletter in the footer). The
 * repository's packs change with the owner's looks; the mechanism's tests
 * read this one instead.
 */
export const FIXTURE_PACKS_DIR = join(__dirname, "fixture-packs")

/** `general/sade` from the tests' folder; throws when it no longer reads. */
export function fixturePreset(): StorefrontPreset {
  const preset = storefrontPreset("general", "sade", FIXTURE_PACKS_DIR)
  if (!preset) {
    throw new Error("no fixture preset general/sade")
  }
  return preset
}
