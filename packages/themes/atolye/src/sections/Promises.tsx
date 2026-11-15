import { fieldKey, fieldMark } from "@qticaret/ui"
import type { TrustBadgeView } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { TrustIcon } from "../parts/TrustIcon"

/** The trust strip's variants this theme draws (adr/0049 Ek 2026-11-14); another draws as `strip`. */
export const PROMISE_VARIANTS = ["strip", "lined"] as const
export type PromiseVariant = (typeof PROMISE_VARIANTS)[number]

interface PromisesProps {
  badges: readonly TrustBadgeView[]
  label: string
  /** Already one this theme draws (`drawnVariant`); none: the strip. */
  variant?: PromiseVariant
  /** The theme editor's live preview (adr/0065 Faz 2b): each badge's words carry their field marks. */
  marks?: boolean | undefined
}

/**
 * The shop's promises (its trust badges, at most four) right under the
 * opening; only what the shop wrote in its settings. As a strip (the
 * default): on a phone (sahip 2026-11-05: "mobilde çok düzenli olmamış")
 * two by two equal cards, each its icon on top, a one-line title and its
 * line under it, so the titles and lines start at the same height; from
 * 640 px the icon beside the text; from 1024 px all across in one tinted
 * strip. Lined (GB4): the same badges as boxes split by hairlines.
 */
export function Promises({ badges, label, variant = "strip", marks }: PromisesProps) {
  if (badges.length === 0) {
    return null
  }
  return (
    <section aria-label={label} className="pt-3 lg:pt-4">
      <Container>
        {variant === "lined" ? (
          <Lined badges={badges} marks={marks} />
        ) : (
          <Strip badges={badges} marks={marks} />
        )}
      </Container>
    </section>
  )
}

/**
 * No empty box in either variant: from 1024 px as many columns as badges
 * (at most four), and on a phone an odd last badge takes the whole row.
 */
const COLUMNS = ["lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"]

/** A variant's badges; `marks`: the editor's field marks, each badge's place in the shared list. */
interface Marked {
  badges: readonly TrustBadgeView[]
  marks?: boolean | undefined
}

const columnsFor = (badges: readonly TrustBadgeView[]) =>
  COLUMNS[Math.min(badges.length, COLUMNS.length) - 1]

function Strip({ badges, marks }: Marked) {
  return (
    <ul
      className={`grid auto-rows-fr grid-cols-2 gap-2 lg:gap-(--gap-columns) lg:rounded-tile lg:bg-paper-2 lg:px-8 lg:py-5 ${columnsFor(badges)}`}
    >
      {badges.map((badge, index) => (
        <li
          key={badge.title}
          className="flex flex-col items-start gap-2.5 rounded-media bg-paper-2 p-3 last:odd:col-span-2 sm:flex-row sm:gap-3 lg:rounded-none lg:bg-transparent lg:p-0 lg:last:odd:col-span-1"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-paper text-text sm:size-10 lg:size-11">
            <TrustIcon icon={badge.icon} className="size-5 shrink-0" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 sm:gap-0">
            <span
              className="text-sm leading-snug font-extrabold tracking-[-0.01em] text-balance lg:text-md"
              {...fieldMark(marks, fieldKey("badges", index, "title"))}
            >
              {badge.title}
            </span>
            {badge.text && (
              <span
                className="text-xs leading-snug text-balance text-text-2 lg:text-sm"
                {...fieldMark(marks, fieldKey("badges", index, "text"))}
              >
                {badge.text}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * GB4 (adr/0049 Ek 2026-11-14 §3.2): one framed row of boxes split by
 * hairlines; two by two on a phone, a column per badge from 1024 px; the
 * icon beside its words, no chip. Between 1024 and 1279 px the boxes are
 * tighter (16 px in, a 24 px icon, the phone's type), so four badges'
 * words keep to one line each and the row stays even (third audit Z-07). Each box draws its right and bottom
 * hairline as a one-pixel shadow on the frame; the frame
 * clips the ones on its edge. The frame is the field colour, or with the
 * theme's lined boxes (`surface_style`, `--box-ground`) the page's ground,
 * as the other boxes on the page (fourth audit W-03).
 */
function Lined({ badges, marks }: Marked) {
  return (
    <ul
      data-variant="lined"
      className={`grid auto-rows-fr grid-cols-2 overflow-hidden rounded-inner border border-rule bg-[color:var(--box-ground,var(--color-field))] ${columnsFor(badges)}`}
    >
      {badges.map((badge, index) => (
        <li
          key={badge.title}
          className="flex items-center gap-3 p-3 shadow-[1px_0_0_0_var(--color-rule),0_1px_0_0_var(--color-rule)] last:odd:col-span-2 lg:px-4 lg:last:odd:col-span-1 xl:gap-4 xl:px-6 xl:py-4"
        >
          <TrustIcon icon={badge.icon} className="size-6 shrink-0 text-text-2 xl:size-8" />
          <span className="flex min-w-0 flex-col gap-px leading-snug">
            <span
              className="text-sm font-extrabold tracking-[-0.01em] text-balance xl:text-md"
              {...fieldMark(marks, fieldKey("badges", index, "title"))}
            >
              {badge.title}
            </span>
            {badge.text && (
              <span
                className="text-2xs text-balance text-text-2 xl:text-xs"
                {...fieldMark(marks, fieldKey("badges", index, "text"))}
              >
                {badge.text}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
