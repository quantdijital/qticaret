import { styleKitAttributes } from "@qticaret/types/style-kit"
import type { ShopView } from "@qticaret/ui"

type Marks = Record<string, string>

/**
 * The marks the theme's root element carries, the attributes its
 * stylesheet reads (`[data-surface="lined"] .gf-subtile`,
 * `[data-chip-style="lined"] .gf-chip`): the box style, always, and the
 * style kit's steps off their default (adr/0067), none at today's drawing.
 */
export function rootMarks(theme: ShopView["theme"]): Marks {
  return { "data-surface": theme.surface ?? "filled", ...styleKitAttributes(theme.styleKit) }
}

/**
 * The marks the page's layers carry (adr/0067 Ek 2026-11-15): a dialog or
 * a drawer is drawn at the end of `body`, outside the root element, so it
 * gets the root's marks on a host of its own (`frame/Layers`). Only while
 * the box style is `lined` (the cart drawer's quantity reads it,
 * `surface.css`) or a kit step is off its default: at `filled` and the
 * kit's defaults `null`, no host, the layers where they always were.
 */
export function layerMarks(theme: ShopView["theme"]): Marks | null {
  const marks = rootMarks(theme)
  return marks["data-surface"] === "filled" && Object.keys(marks).length === 1 ? null : marks
}
