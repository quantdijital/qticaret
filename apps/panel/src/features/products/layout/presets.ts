import {
  DEFAULT_LAYOUT,
  FOLDED_PARTS,
  MAIN_PARTS,
  SIDE_PARTS,
  TAB_PARTS,
  isLocked,
  sameLayout,
} from "./parts"
import type { PartKey, ProductLayout } from "./parts"

/**
 * The ready layouts of "Sayfayı düzenle" (docs/06 "Ürün sayfası"), one
 * click each; a preset only fills the draft, "Kaydet" still keeps it.
 *
 * - **Basit**: the name and address, the data card with only its price,
 *   stock and variants tabs,
 *   the pictures, the description and the SEO advisor. The parts a dated
 *   product needs (departures, program) stay: they draw only when used.
 * - **Standart**: the default layout.
 * - **Gelişmiş**: everything shown, the folded parts open.
 */
export const PRESETS = ["basic", "standard", "advanced"] as const
export type Preset = (typeof PRESETS)[number]

// Shown by "Basit" besides the locked parts
const BASIC_SHOWN: ReadonlySet<PartKey> = new Set([
  "media",
  "description",
  "stock",
  "departures",
  "program",
])

const ALL_KEYS: readonly PartKey[] = [...MAIN_PARTS, ...SIDE_PARTS, ...TAB_PARTS].map(
  (part) => part.key
)

/** The layout a preset makes of the current one: the columns' order stays as arranged. */
export function applyPreset(preset: Preset, current: ProductLayout): ProductLayout {
  const order = { main: current.main, side: current.side }
  switch (preset) {
    case "basic":
      return {
        ...order,
        hidden: ALL_KEYS.filter((key) => !isLocked(key) && !BASIC_SHOWN.has(key)),
        open: [],
      }
    case "standard":
      return { ...order, hidden: DEFAULT_LAYOUT.hidden, open: DEFAULT_LAYOUT.open }
    case "advanced":
      return { ...order, hidden: [], open: [...FOLDED_PARTS] }
  }
}

/** The preset a layout is, whatever order its columns are in; none when arranged by hand. */
export function presetOf(layout: ProductLayout): Preset | null {
  return PRESETS.find((preset) => sameLayout(applyPreset(preset, layout), layout)) ?? null
}
