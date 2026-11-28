import { TitleText } from "../parts/TitleText"
import { fieldMark } from "@qticaret/ui"
import type { DepartureRowView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Price } from "../parts/Price"
import { BandPicture } from "./BandPicture"
import { type Of, headingId } from "./plan"
import { HeadEyebrow, HeadNote } from "./head-lines"

/** A card's photograph: a third of the row from 1024 px, half from 768 px. */
const CARD_SIZES = "(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"

/**
 * The date box: the day large between the month and the weekday, said
 * whole for a screen reader (the box's parts are for the eye).
 */
function DateBox({ row, className }: { row: DepartureRowView; className?: string }) {
  const { date } = row
  return (
    <time
      dateTime={date.iso}
      className={cn(
        "flex w-16 shrink-0 flex-col items-center gap-1 rounded-inner border border-rule bg-paper py-2 leading-none",
        className
      )}
    >
      <span aria-hidden="true" className="text-xs font-semibold text-text-2 uppercase">
        {date.month}
      </span>
      <span aria-hidden="true" className="tabular text-2xl font-extrabold text-text">
        {date.day}
      </span>
      <span aria-hidden="true" className="text-xs text-text-2">
        {date.weekday}
      </span>
      <span className="sr-only">{date.full}</span>
    </time>
  )
}

/** "İncele", said with the tour and its date for a screen reader (every row has one). */
function Open({
  row,
  open,
  className,
}: {
  row: DepartureRowView
  open: string
  className?: string
}) {
  return (
    <a href={row.path} className={cn("gf-btn gf-btn--small", className)}>
      {open}
      <span className="sr-only">
        : {row.title}, {row.date.full}
      </span>
    </a>
  )
}

/** The places left when few, in the deal's ink (the card's "Son N yer"). */
const Left = ({ text }: { text: string | null }) =>
  text ? <p className="text-sm font-semibold text-deal">{text}</p> : null

/**
 * Upcoming departures (`departures`, adr/0077 §10): the heading and an
 * optional intro, then the nearest departures by date. `list`: one row
 * each under a hairline, the date box, the tour's name and the places left
 * when few, then the price and "İncele" at the row's end (on a phone
 * under the name, beside the date box, the row kept tight). `cards`: a card each, the tour's photograph in its well
 * with the date box on it, the name, the places left, the price and
 * "İncele". Its ground and alignment are the section's look (`Look`).
 */
export function Departures({ section, t }: { section: Of<"departures">; t: Translate }) {
  const id = headingId(section.id)
  const cards = section.layout === "cards"
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container className="flex flex-col gap-(--head-gap)">
        <div className="flex max-w-2xl flex-col gap-2 group-data-[align=center]/look:mx-auto group-data-[align=center]/look:items-center group-data-[align=center]/look:text-center">
          <HeadEyebrow lines={section} marks={section.editor} />
          {section.note ? (
            // The hand note right after the heading (under it on a narrow screen)
            <div className="flex flex-wrap items-end gap-x-6 gap-y-1 group-data-[align=center]/look:justify-center">
              <h2 id={id} {...fieldMark(section.editor, "title")}>
                <TitleText text={section.title} />
              </h2>
              <HeadNote lines={section} marks={section.editor} />
            </div>
          ) : (
            <h2 id={id} {...fieldMark(section.editor, "title")}>
              <TitleText text={section.title} />
            </h2>
          )}
          {section.intro && (
            <p className="text-text-2" {...fieldMark(section.editor, "intro")}>
              {section.intro}
            </p>
          )}
        </div>
        {cards ? (
          <ul
            role="list"
            className="grid gap-x-(--gap-columns) gap-y-(--gap-rows) md:grid-cols-2 lg:grid-cols-3"
          >
            {section.rows.map((row) => (
              <li key={row.key} className="flex flex-col overflow-hidden rounded-tile gf-pane">
                <div className="relative isolate aspect-[4/3] bg-media">
                  {row.image && (
                    <BandPicture image={row.image} phone={null} sizes={CARD_SIZES} eager={false} />
                  )}
                  <DateBox row={row} className="absolute top-3 left-3" />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="text-title font-semibold text-text">{row.title}</h3>
                  <Left text={row.left} />
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                    {row.price ? <Price price={row.price} t={t} /> : <span />}
                    <Open row={row} open={section.open} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul role="list" className="border-b border-rule">
            {section.rows.map((row) => (
              <li
                key={row.key}
                className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 border-t border-rule py-3 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:items-center md:py-4"
              >
                <DateBox row={row} className="row-span-2 md:row-span-1" />
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-title font-semibold text-text">{row.title}</h3>
                  <Left text={row.left} />
                </div>
                <div className="col-start-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 md:col-start-3 md:justify-end">
                  {row.price && <Price price={row.price} t={t} />}
                  <Open row={row} open={section.open} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  )
}
