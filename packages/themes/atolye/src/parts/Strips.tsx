import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** How steep the seams run: `soft` the fixed run from before the setting, the others a share of the height. */
export type StripSlant = "soft" | "medium" | "steep"
/** The line between two strips (`--strip-line`): none, 4, 12 or 16/24 px. */
export type StripLine = "none" | "thin" | "medium" | "thick"

/** How the strips draw (`strips.css` reads each as an attribute). */
export interface StripsLook {
  slant: StripSlant
  line: StripLine
  /** Each strip lies over the one before it, with a shadow; the one under the pointer on top. */
  overlap: boolean
  /** The other strips darken while one is under the pointer or holds the keyboard's focus. */
  dim: boolean
  /** `grow` (the default): the strip under the pointer or the focus widens; `still`: they stay equal. */
  hover?: "grow" | "still"
}

/** The drawing from before the look's settings (adr/0049 Ek 2026-11-15): soft seams, a 12 px gap. */
export const STRIPS_LOOK_BEFORE: StripsLook = {
  slant: "soft",
  line: "medium",
  overlap: false,
  dim: false,
}

/** One strip: a photograph, optionally words over its foot, optionally a link (the whole strip). */
export interface StripItem {
  /** Unique among the strips (React's key). */
  key: string
  image: ImageView
  /** The whole strip a link to it; none: a plain picture. */
  href?: string | null | undefined
  /** A line over the photograph's foot (a product's name, a category). */
  title?: string | null | undefined
  /** A smaller line under it (a price, a count, the shop's words). */
  note?: string | null | undefined
  /** The editor's field marks on the words (`fieldMark`). */
  titleMark?: { "data-qf"?: string } | undefined
  noteMark?: { "data-qf"?: string } | undefined
}

/** How far a strip under the pointer widens against the others (`--strip-grow`, strips.css). */
const GROW = 2.75

/** The most strips a tablet's width (640–1023 px) and a phone's (below 640) show (strips.css). */
export const STRIPS_TABLET_MAX = 4
export const STRIPS_PHONE_MAX = 3

/** The most strips the stylesheet counts (`data-count`, `--strip-count`). */
export const STRIPS_MOST = 8

/**
 * How much wider than the box the strips' sum runs, per seam, as a share
 * of the box's width (each seam's run and overlap, less its line): an
 * estimate for a box about 4:3, so a wider one gets a slightly larger
 * image, never a smaller one. Soft seams with today's gap add nothing.
 */
const SEAM_SHARE: Readonly<Record<StripSlant, number>> = { soft: 0, medium: 0.09, steep: 0.17 }
const OVERLAP_SHARE = 0.04

/**
 * The image's `sizes` for `count` strips over `span` vw of the screen from
 * 1024 px (below, the strips take the screen's width): from 1024 px a
 * widened strip's share (the image is drawn that wide, so it does not jump
 * as the strip widens); below, an equal share of the screen, of the four a
 * tablet or the three a phone shows when there are more.
 */
export function stripSizes(
  count: number,
  span: number,
  look: Pick<StripsLook, "slant" | "overlap" | "hover"> = STRIPS_LOOK_BEFORE
): string {
  const grow = look.hover !== "still"
  const seams = (count - 1) * (SEAM_SHARE[look.slant] + (look.overlap ? OVERLAP_SHARE : 0))
  const sum = span * (1 + seams)
  const open = Math.ceil(
    count > 1 ? (grow ? (sum * GROW) / (GROW + count - 1) : sum / count) : span
  )
  const wide = `(min-width: 1024px) ${open}vw`
  const share = (strips: number) => `${Math.ceil(100 / strips)}vw`
  const tablet = Math.min(count, STRIPS_TABLET_MAX)
  const phone = Math.min(count, STRIPS_PHONE_MAX)
  return tablet === phone
    ? `${wide}, ${share(phone)}`
    : `${wide}, (min-width: 640px) ${share(tablet)}, ${share(phone)}`
}

/**
 * Photographs as upright strips side by side with parallel slanted seams
 * (adr/0049 Ek 2026-11-15, 2026-11-16), the outer edges straight so they
 * end a rectangle: the featured product's gallery, and any section that
 * wants the same drawing. From 1024 px the strip under a hovering pointer,
 * or holding the keyboard's focus, widens and the others narrow, its
 * photograph fixed in place; a tablet shows four at most, a phone three,
 * a screen without a hovering pointer keeps them equal (a tap follows the
 * strip's link). No script and no inline style (CSP): the look and the
 * count are attributes, `strips.css` the drawing. The box needs a definite
 * height (an aspect ratio or a height in `className`): it is a size
 * container, the seams' run a share of it.
 */
export function Strips({
  items,
  look,
  max = 4,
  span,
  label,
  className,
}: {
  items: readonly StripItem[]
  look: StripsLook
  /** The most strips from 1024 px (at most `STRIPS_MOST`). */
  max?: number | undefined
  /** The strips' share of the screen from 1024 px, in vw (the images' `sizes`). */
  span: number
  /** The list's name, when the section's heading does not name it. */
  label?: string | undefined
  className?: string | undefined
}) {
  const shown = items.slice(0, Math.min(max, STRIPS_MOST))
  const grow = look.hover !== "still"
  const sizes = stripSizes(shown.length, span, look)
  return (
    <ul
      className={cn("gf-strips rounded-media", className)}
      aria-label={label}
      data-count={shown.length}
      data-slant={look.slant === "soft" ? undefined : look.slant}
      data-line={look.line === "medium" ? undefined : look.line}
      data-overlap={look.overlap ? "on" : undefined}
      data-dim={look.dim ? "on" : undefined}
      data-hover={grow ? undefined : "still"}
    >
      {shown.map((item) => {
        const words = Boolean(item.title) || Boolean(item.note)
        const inner = (
          <span className="gf-strip-frame">
            <ResponsiveImage image={item.image} sizes={sizes} className="gf-strip-image" />
            {words ? (
              <span className="gf-strip-text">
                {item.title ? (
                  <span className="gf-strip-title" {...item.titleMark}>
                    {item.title}
                  </span>
                ) : null}
                {item.note ? (
                  <span className="gf-strip-note" {...item.noteMark}>
                    {item.note}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        )
        return (
          <li key={item.key} className="gf-strip">
            {item.href ? (
              <a href={item.href} className="gf-strip-cut">
                {inner}
              </a>
            ) : (
              <div className="gf-strip-cut">{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
