import type { Oklch } from "culori"
import type { ThemeSidebar } from "@qticaret/types"
import { AA_LARGE, AA_TEXT, contrast, css, oklch, readableFill, standOut, textOn } from "./color"
import type { Brand } from "./color"
import { tone } from "./ground"
import type { Ground } from "./ground"

/**
 * The navigation's colours (docs/18 §5): ink, light, or the brand colour;
 * ink and light are drawn in the surfaces' tone (`ground.ts`).
 * Every text colour is checked against its own surface, so a light brand
 * still gets a readable menu.
 */

type Mode = "light" | "dark"

interface SidebarColors {
  bg: Oklch
  fg: Oklch
  muted: Oklch
  accent: Oklch
  border: Oklch
  primary: Oklch
}

/** A text colour on `bg`, lightness moved towards the far end until it reads at `ratio`. */
function readableOn(bg: Oklch, start: number, ratio: number, g: Ground): Oklch {
  const direction = bg.l > 0.5 ? -1 : 1
  let color = tone(g, start)
  let steps = 0
  while (contrast(color, bg) < ratio && steps < 60) {
    color = tone(g, color.l + direction * 0.01)
    steps += 1
  }
  return color
}

// Ink: a dark navigation in both page modes, in the ground's tone
function ink(brand: Brand, g: Ground, mode: Mode): SidebarColors {
  const bg = tone(g, mode === "light" ? 0.21 : 0.125, g.ink)
  const raised = tone(g, bg.l + 0.07, g.ink)
  return {
    bg,
    fg: readableOn(bg, 0.92, AA_TEXT, g),
    muted: readableOn(bg, 0.68, AA_TEXT, g),
    accent: raised,
    border: raised,
    primary: standOut(brand, bg, AA_LARGE, Math.max(brand.l, 0.72)),
  }
}

function light(brand: Brand, g: Ground, mode: Mode, dark: Oklch): SidebarColors {
  if (mode === "dark") {
    const bg = tone(g, 0.17)
    return {
      bg,
      fg: readableOn(bg, 0.94, AA_TEXT, g),
      muted: readableOn(bg, 0.7, AA_TEXT, g),
      accent: tone(g, 0.24),
      border: tone(g, 0.27),
      primary: standOut(brand, bg, AA_LARGE, Math.max(brand.l, 0.68)),
    }
  }
  const bg = oklch(1, 0, 0)
  return {
    bg,
    fg: tone(g, 0.22),
    muted: readableOn(bg, 0.5, AA_TEXT, g),
    accent: tone(g, 0.955, g.sidebarAccent),
    border: tone(g, 0.925),
    primary: readableFill(brand, [0.4, 0.62], dark).color,
  }
}

// The brand colour as the surface: deep enough for white text
function branded(brand: Brand, g: Ground, mode: Mode, dark: Oklch): SidebarColors {
  const bg =
    mode === "light"
      ? readableFill(brand, [0.3, 0.46], dark).color
      : oklch(0.27, Math.min(brand.c, 0.08), brand.h)
  const fg = textOn(bg, dark)
  const raised = oklch(Math.max(bg.l - 0.06, 0.12), bg.c, brand.h)
  return {
    bg,
    fg,
    muted: readableOn(bg, fg.l > 0.5 ? 0.82 : 0.3, AA_TEXT, g),
    accent: raised,
    border: raised,
    primary: fg,
  }
}

export function sidebarVars(
  style: ThemeSidebar,
  brand: Brand,
  g: Ground,
  mode: Mode,
  dark: Oklch
): Record<`--${string}`, string> {
  const colors =
    style === "dark"
      ? ink(brand, g, mode)
      : style === "brand"
        ? branded(brand, g, mode, dark)
        : light(brand, g, mode, dark)
  const accentText = readableOn(colors.accent, colors.fg.l, AA_TEXT, g)
  return {
    "--sidebar": css(colors.bg),
    "--sidebar-foreground": css(colors.fg),
    "--sidebar-muted-foreground": css(colors.muted),
    "--sidebar-primary": css(colors.primary),
    "--sidebar-primary-foreground": css(textOn(colors.primary, dark)),
    "--sidebar-accent": css(colors.accent),
    "--sidebar-accent-foreground": css(accentText),
    "--sidebar-border": css(colors.border),
    "--sidebar-ring": css(colors.primary),
  }
}
