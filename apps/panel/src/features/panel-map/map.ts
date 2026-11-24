import { PANEL_MAP as SHARED_MAP } from "@qticaret/types/panel-map"
import type { PanelMapEntry } from "@qticaret/types/panel-map"
import type { Capability } from "@/features/auth/api/staff"
import { trailIn } from "./search"

/** A screen of the panel's map (adr/0079 §4), its capability one the panel knows. */
export type PanelScreen = PanelMapEntry<Capability>

/**
 * The shared map, its `needs` read as the panel's capabilities: map.spec.ts
 * checks every one against the panel's own list, as it checks every path
 * against the routes.
 */
export const PANEL_MAP = SHARED_MAP as readonly PanelScreen[]

const BY_KEY: ReadonlyMap<string, PanelScreen> = new Map(
  PANEL_MAP.map((screen) => [screen.key, screen])
)

/** A screen by its key; a key the map lacks is a mistake in code. */
export function panelScreen(key: string): PanelScreen {
  const screen = BY_KEY.get(key)
  if (!screen) {
    throw new Error(`no panel screen "${key}"`)
  }
  return screen
}

/** The screens a screen sits under, the outermost first (Ayarlar, then Kargo ve teslimat). */
export const trailOf = (screen: PanelScreen): PanelScreen[] => trailIn(screen, BY_KEY)
