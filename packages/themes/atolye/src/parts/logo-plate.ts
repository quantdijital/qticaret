import type { ImageView } from "@qticaret/ui"

/*
 * A logo plate's width on the brands page (`BrandsPage`), in 4 px steps
 * from the 40 px square to 120 px: written out whole so Tailwind finds
 * each class (no inline style: CSP).
 */
const PLATE_WIDTHS = [
  "w-10",
  "w-11",
  "w-12",
  "w-13",
  "w-14",
  "w-15",
  "w-16",
  "w-17",
  "w-18",
  "w-19",
  "w-20",
  "w-21",
  "w-22",
  "w-23",
  "w-24",
  "w-25",
  "w-26",
  "w-27",
  "w-28",
  "w-29",
  "w-30",
] as const

const PLATE = { height: 40, min: 40, max: 120, step: 4 } as const

/**
 * The plate's width class for a logo whose size the server read, or null
 * (unknown: the plate takes the logo's width once it loads, as before).
 * It is the width the logo is drawn at, as the plate measured it after
 * the file came: never above its own pixels, at most 40 px tall, then
 * between the square and 120 px; up to the next 4 px, so the logo stays
 * whole. Set before the file arrives, the name beside the plate does not
 * move when it does.
 */
export function logoPlateWidth(logo: Pick<ImageView, "width" | "height">): string | null {
  const { width, height } = logo
  if (!width || !height || width <= 0 || height <= 0) {
    return null
  }
  const drawn = height > PLATE.height ? (width * PLATE.height) / height : width
  const px = Math.min(PLATE.max, Math.max(PLATE.min, drawn))
  // A hair over a step (a float's rounding) is that step, not the next
  const step = Math.ceil((px - PLATE.min) / PLATE.step - 1e-6)
  return PLATE_WIDTHS[step] ?? null
}
