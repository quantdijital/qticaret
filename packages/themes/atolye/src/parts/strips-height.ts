import type { StripsShape } from "./Strips"

/** The strips' height steps every strips section offers (`STRIPS_HEIGHTS`). */
export type StripsHeight = "low" | "medium" | "high"

/**
 * The strips' height as Atölye draws it (bilesen-standardi §3): a phone's,
 * a tablet's and a wide screen's proportion, a wide screen's held under
 * the viewport's height; each class list written whole so Tailwind finds
 * it. The strip gallery's and a product rail's strips alike.
 */
export const STRIPS_HEIGHT: Readonly<Record<StripsHeight, string>> = {
  low: "aspect-[4/3] sm:aspect-[2/1] lg:aspect-[3/1] max-h-[60svh]",
  medium: "aspect-square sm:aspect-[16/9] lg:aspect-[12/5] max-h-[78svh]",
  high: "aspect-[4/5] sm:aspect-[4/3] lg:aspect-[16/9] max-h-[88svh]",
}

/** The same heights as numbers, height over width (the images' `sizes`, `StripsShape`). */
export const STRIPS_SHAPE: Readonly<Record<StripsHeight, StripsShape>> = {
  low: { phone: 3 / 4, tablet: 1 / 2, desktop: 1 / 3 },
  medium: { phone: 1, tablet: 9 / 16, desktop: 5 / 12 },
  high: { phone: 5 / 4, tablet: 3 / 4, desktop: 9 / 16 },
}
