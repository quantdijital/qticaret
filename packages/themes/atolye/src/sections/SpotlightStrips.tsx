import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"

/** The most photographs the strips show: four still read as photographs beside the words. */
export const STRIPS_MAX = 4

/** The most a phone's width (below 640 px) shows; more would be slivers (spotlight.css). */
export const STRIPS_PHONE_MAX = 3

/** How far a strip under the pointer widens against the others (`--strip-grow`, spotlight.css). */
const GROW = 2.75

/** The gallery's share of the screen from 1024 px (7 of the stage's 12 columns), in vw. */
const GALLERY = 53

/**
 * The image's `sizes` for `count` strips: from 1024 px a widened strip's
 * share of the gallery's column (the image is drawn that wide, so it does
 * not jump as the strip widens); below, an equal share of the screen, of
 * the three a phone shows when there are more.
 */
export function stripSizes(count: number): string {
  const open = Math.ceil((GALLERY * GROW) / (GROW + count - 1))
  const wide = `(min-width: 1024px) ${count > 1 ? open : GALLERY}vw`
  const share = (strips: number) => `${Math.ceil(100 / strips)}vw`
  return count > STRIPS_PHONE_MAX
    ? `${wide}, (min-width: 640px) ${share(count)}, ${share(STRIPS_PHONE_MAX)}`
    : `${wide}, ${share(count)}`
}

/**
 * The featured product's photographs as equal upright strips with slanted
 * seams (`gallery: "strips"`, adr/0049 Ek 2026-11-15), the outer edges
 * straight so the gallery ends a rectangle. From 1024 px the strip under
 * the pointer, or holding the keyboard's focus, widens and the others
 * narrow, its photograph fixed in place; on a phone, or a screen without
 * a pointer that hovers, they stay equal. Each strip is a link to the
 * product's page, named by its photograph. No script: the drawing is
 * `spotlight.css`.
 */
export function SpotlightStrips({
  pictures,
  path,
  className,
}: {
  pictures: readonly ImageView[]
  path: string
  className: string
}) {
  const shown = pictures.slice(0, STRIPS_MAX)
  const sizes = stripSizes(shown.length)
  return (
    <ul
      className={`gf-strips rounded-media ${className}`}
      data-count={shown.length}
      data-gallery="strips"
    >
      {shown.map((image) => (
        <li key={image.src} className="gf-strip bg-stage-2">
          <a href={path} className="gf-strip-link">
            <ResponsiveImage image={image} sizes={sizes} className="gf-strip-image" />
          </a>
        </li>
      ))}
    </ul>
  )
}
