import type { ReactNode } from "react"
import { fieldKey, fieldMark } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { BrushStroke } from "../parts/BrushStroke"
import { Eyebrow } from "../parts/Eyebrow"
import { HandNote } from "../parts/HandNote"
import { SectionIcon } from "../parts/SectionIcon"
import type { Of } from "./plan"

type Stats = Of<"stats">

/** Features a line from 1024 px: all of them, as the shop has two to six. */
const WIDE: Readonly<Record<number, string>> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
}

/**
 * The strip's head once the shop wrote a line over it or a note beside it:
 * the small upper-case line over the heading, the hand note at the head's
 * end on a wide screen (tilted, a brush stroke in the accent under it),
 * under the heading on a narrow one. Without either the head is as before.
 */
export function StatsHead({ section, heading }: { section: Stats; heading: ReactNode }) {
  if (!section.eyebrow && !section.note) {
    return heading
  }
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {section.eyebrow && (
          <Eyebrow text={section.eyebrow} mark={fieldMark(section.editor, "eyebrow")} />
        )}
        {heading}
      </div>
      {section.note && (
        <div className="w-fit shrink-0 lg:w-52 xl:w-60">
          <HandNote
            note={section.note}
            mark={fieldMark(section.editor, "note")}
            className="-rotate-6 text-text lg:mx-auto lg:text-center"
          />
          <BrushStroke className="ml-0 text-(--highlight) lg:mx-auto" />
        </div>
      )}
    </div>
  )
}

/**
 * The strip's items as features (`item_style: feature`, Wanderly's "More
 * Than Just Trips"): each its icon on a light disc of the shop's accent,
 * its label in bold and its one quiet line; the value is not drawn (it
 * stays the figure's, should the shop turn the figures back). One a line
 * on a phone, two from 640 px, all in one line from 1024 px, hairlines
 * between them there while `dividers` is on. A list (`dl`): each label a
 * term, its line its description.
 */
export function StatsFeatures({ section }: { section: Stats }) {
  const lined = section.dividers === "on"
  const qf = (at: number, part: string) => fieldMark(section.editor, fieldKey("items", at, part))
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-(--gap-columns) gap-y-6 sm:grid-cols-2",
        WIDE[section.items.length],
        lined && "lg:gap-x-0"
      )}
    >
      {section.items.map((item, at) => (
        <div
          key={`${String(at)}-${item.label}`}
          className={cn(
            "flex min-w-0 flex-col gap-1 group-data-[align=center]/look:items-center group-data-[align=center]/look:text-center",
            lined &&
              "lg:border-l lg:border-rule lg:px-(--gap-columns) lg:first:border-l-0 lg:first:pl-0"
          )}
        >
          <dt className="order-2 mt-3 font-semibold text-text" {...qf(at, "label")}>
            {item.label}
          </dt>
          {item.text && (
            <dd className="order-3 text-sm text-text-2" {...qf(at, "text")}>
              {item.text}
            </dd>
          )}
          {/* The icon on its disc, for the eye only (adr/0077 §10 Ek) */}
          {item.icon && (
            <dd
              aria-hidden="true"
              className="order-1 grid size-12 place-items-center rounded-full bg-[color-mix(in_oklab,var(--highlight)_32%,var(--color-paper))] text-signal"
            >
              <SectionIcon icon={item.icon} className="size-6 shrink-0" />
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}
