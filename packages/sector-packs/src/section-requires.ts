import type { FlagPreset } from "./schema"
import type { PresetLayout } from "./preset-schema"
import { SectorPackError } from "./read-json"

/**
 * Section type → the feature flag it needs (adr/0077 §8). Mirrors
 * `@qticaret/types`' `SECTION_REQUIRES` (the loader runs compiled, reading
 * no runtime value from that package); a test keeps them equal. Empty
 * until the first flagged section (`departures`, adr/0077 §10).
 */
export const SECTION_REQUIRES: Readonly<Record<string, string>> = {}

/** Every section type a preset lays out: its groups' and its content pages'. */
function typesOf(layout: PresetLayout): Set<string> {
  const { pages = [], ...groups } = layout
  return new Set(
    [...Object.values(groups), ...pages.map((page) => page.sections)].flatMap(
      (sections) => sections?.map((each) => each.type) ?? []
    )
  )
}

/**
 * A pack's presets may lay out a flagged section only when the pack's
 * flags turn its flag on (adr/0077 §8): a shop the pack sets up would
 * otherwise get a look whose sections it never sees. Throws naming the
 * preset, the section type and the flag.
 */
export function checkPresetFlags(
  pack: {
    code: string
    flags: readonly FlagPreset[]
    presets: readonly { code: string; layout: PresetLayout }[]
  },
  requires: Readonly<Record<string, string>> = SECTION_REQUIRES
): void {
  const on = new Set(pack.flags.filter((flag) => flag.enabled).map((flag) => flag.key))
  for (const preset of pack.presets) {
    for (const type of typesOf(preset.layout)) {
      const flag = Object.hasOwn(requires, type) ? requires[type] : undefined
      if (flag !== undefined && !on.has(flag)) {
        throw new SectorPackError(
          `${pack.code}/presets/${preset.code}: section ${type} needs flag ${flag}, which flags.json does not turn on`
        )
      }
    }
  }
}
