import { fieldKey, fieldMark } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { SectionIcon } from "../parts/SectionIcon"
import { StatsFollow } from "./StatsFollow"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"
import { StatsFeatures, StatsHead } from "./stats-parts"

/** Figures a line from 1024 px: all of them, as the shop has two to six. */
const WIDE: Readonly<Record<number, string>> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
}

/** From 768 px: three a line where the count splits into threes, else two. */
const MIDDLE: Readonly<Record<number, string>> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2",
  5: "md:grid-cols-3",
  6: "md:grid-cols-3",
}

/**
 * Each part's classes, stacked (today's) or in one tight row
 * (`arrangement: row`): the icon at the left, the value over the label
 * beside it, set smaller.
 */
const PARTS = {
  stacked: {
    item: "flex min-w-0 flex-col gap-2 group-data-[align=center]/look:items-center group-data-[align=center]/look:text-center",
    label: "order-2 text-md font-semibold text-text",
    value:
      "tabular order-1 text-[clamp(2.25rem,1.8vw+1.6rem,3.5rem)] leading-none font-extrabold tracking-(--tracking-display) break-words",
    text: "order-3 max-w-[32ch] text-sm text-text-2",
    icon: "order-0 text-signal in-[.gf-stage]:text-signal-on-stage",
    glyph: "size-8 shrink-0 lg:size-9",
  },
  row: {
    item: "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3",
    label: "order-2 col-start-2 text-xs font-medium text-text-2",
    value:
      "tabular order-1 col-start-2 text-[1.625rem] leading-none font-extrabold tracking-(--tracking-display)",
    text: "order-3 col-start-2 max-w-[32ch] text-xs text-text-2",
    icon: "order-0 row-span-2 text-text",
    glyph: "size-8 shrink-0 lg:size-9",
  },
} as const

/**
 * The figures strip (`stats`, adr/0077 §10): the shop's two to six figures
 * set large in the heading face's heaviest weight, each over its label and
 * an optional quiet line; two a line on a phone, all in one line from
 * 1024 px. With `dividers` on, hairlines part them (a rule above each on a
 * narrow screen, beside each from 1024 px); off, space alone. One list
 * (`dl`): a screen reader hears each label with its value; the figure
 * stands first only for the eye. The values are the shop's words as they
 * are, never counted up or moved. Its ground and alignment are the
 * section's look (`Look`): on the graphite stage the figures turn light
 * with the stage's own inks, centred the head and every figure centre.
 * `arrangement: row` sets them in one tight row, each icon at the left of
 * its value and label, the shop's profiles at the row's end (`follow`).
 * `item_style: feature` draws each item as a feature instead (its icon on
 * a light disc, the label in bold, one quiet line); the arrangement then
 * does not apply.
 */
export function Stats({ section }: { section: Of<"stats"> }) {
  const id = headingId(section.id)
  const count = section.items.length
  const row = section.arrangement === "row"
  const lined = section.dividers === "on"
  const parts = row ? PARTS.row : PARTS.stacked
  const qf = (at: number, part: string) => fieldMark(section.editor, fieldKey("items", at, part))
  const list = (
    <dl
      className={
        row
          ? "flex flex-wrap items-center gap-x-10 gap-y-5 lg:gap-x-14"
          : cn(
              "grid grid-cols-2 gap-x-(--gap-columns) gap-y-(--gap-rows)",
              MIDDLE[count],
              WIDE[count],
              lined && "lg:gap-x-0"
            )
      }
    >
      {section.items.map((item, at) => (
        <div
          key={`${String(at)}-${item.value}`}
          className={cn(
            parts.item,
            lined &&
              !row &&
              "border-t border-rule pt-5 lg:border-t-0 lg:border-l lg:px-(--gap-columns) lg:pt-0 lg:first:border-l-0 lg:first:pl-0"
          )}
        >
          <dt className={parts.label} {...qf(at, "label")}>
            {item.label}
          </dt>
          <dd className={parts.value} {...qf(at, "value")}>
            {item.value}
          </dd>
          {item.text && (
            <dd className={parts.text} {...qf(at, "text")}>
              {item.text}
            </dd>
          )}
          {/* The figure's icon over its value, for the eye only (adr/0077 §10 Ek) */}
          {item.icon && (
            <dd aria-hidden="true" className={parts.icon}>
              <SectionIcon icon={item.icon} className={parts.glyph} />
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
  return (
    <section
      {...(section.title ? { "aria-labelledby": id } : { "aria-label": section.label })}
      className="gf-section"
    >
      {/* The features set close: a smaller step from the head to the row */}
      <Container
        className={cn(
          "flex flex-col",
          section.item_style === "feature" ? "gap-(--head-gap-s)" : "gap-(--head-gap)"
        )}
      >
        <StatsHead
          section={section}
          heading={
            section.title && <SectionHead id={id} title={section.title} marks={section.editor} />
          }
        />
        {section.item_style === "feature" ? (
          <StatsFeatures section={section} />
        ) : row ? (
          <div className="flex flex-wrap items-center justify-between gap-x-(--gap-columns) gap-y-6">
            {list}
            {section.follow && <StatsFollow id={`${id}-izle`} follow={section.follow} />}
          </div>
        ) : (
          list
        )}
      </Container>
    </section>
  )
}
