import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCollageView, LinkView, LinkedCategoryCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { collageRows } from "./collage-rows"
import type { CollageSpan } from "./collage-rows"
import { SectionHead } from "./SectionHead"

/** A card's width in twelfths at each screen, written whole for Tailwind. */
const PHONE: Record<6 | 12, string> = { 6: "col-span-6", 12: "col-span-12" }
const TABLET: Record<6 | 12, string> = { 6: "sm:col-span-6", 12: "sm:col-span-12" }
const DESKTOP: Record<CollageSpan, string> = {
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
}

/** Half a row or all of it, on a phone or a tablet. */
const half = (span: CollageSpan): 6 | 12 => (span === 12 ? 12 : 6)

/** How wide the photo shows, for its `sizes`. */
const sizesOf = (desktop: CollageSpan, tablet: 6 | 12, phone: 6 | 12): string =>
  `(min-width: 1024px) ${String(Math.round((desktop / 12) * 92))}vw, ` +
  `(min-width: 640px) ${String(tablet === 12 ? 92 : 46)}vw, ${String(phone === 12 ? 92 : 46)}vw`

function Card({
  card,
  lead,
  leadRow,
  spans,
  t,
}: {
  card: LinkedCategoryCardView
  lead: boolean
  leadRow: boolean
  spans: { desktop: CollageSpan; tablet: 6 | 12; phone: 6 | 12 }
  t?: Translate | undefined
}) {
  const picture = card.image ?? null
  return (
    <article
      className="gf-collage-card gf-pane relative flex h-full min-w-0 flex-col rounded-tile p-2"
      {...(lead ? { "data-lead": "" } : {})}
      {...(leadRow ? { "data-lead-row": "" } : {})}
    >
      <div className="gf-collage-photo overflow-hidden rounded-media bg-media">
        {picture ? (
          <ResponsiveImage
            image={{ ...picture, alt: "" }}
            sizes={sizesOf(spans.desktop, spans.tablet, spans.phone)}
            className="h-full w-full object-cover"
          />
        ) : (
          // No picture yet: the name's first letter keeps the card's shape, words below as ever
          <span
            aria-hidden="true"
            className="grid h-full place-items-center text-figure leading-none font-extrabold text-text-3 opacity-40"
          >
            {card.label.trim().charAt(0).toLocaleUpperCase("tr-TR")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-2 pt-3 pb-1 sm:px-3 sm:pt-4">
        <div className="flex items-baseline justify-between gap-x-4 gap-y-1 max-sm:flex-wrap">
          <h3
            className={cn(
              "min-w-0 leading-tight font-extrabold tracking-[-0.015em] break-words text-balance",
              lead ? "text-section lg:text-display" : "text-title"
            )}
          >
            {/* The whole card is the category's link: one stop for the keyboard, the card framed on focus */}
            <a
              href={card.path}
              className="gf-collage-link no-underline after:absolute after:inset-0 after:rounded-tile after:content-['']"
            >
              {card.label}
            </a>
          </h3>
          {t && typeof card.count === "number" && (
            <p className="shrink-0 text-sm font-semibold text-text-3 tabular-nums">
              {t("listing.count", { count: card.count.toLocaleString("tr-TR") })}
            </p>
          )}
        </div>
        {card.children.length > 0 && <Children links={card.children} />}
      </div>
    </article>
  )
}

/** The first subcategories, quiet words in one wrapping line above the card's link. */
function Children({ links }: { links: LinkView[] }) {
  return (
    <ul className="relative z-[1] mt-2 flex flex-wrap gap-x-4 sm:mt-3">
      {links.map((child) => (
        <li key={child.path} className="min-w-0">
          <a
            href={child.path}
            className="flex min-h-11 items-center text-sm break-words text-text-2 no-underline underline-offset-4 hover:text-text hover:underline lg:pointer-fine:min-h-8"
          >
            {child.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * The category cards' `collage` variant (adr/0049 Ek 2026-11-15): each
 * category a card led by its photograph (the photo well's height a named
 * step, the lead's row a step taller), its name in 800 under it with the
 * count on the same line, its first subcategories as quiet links that
 * wrap. The whole card links to the category; the subcategories are their
 * own stops. Rows fill edge to edge (`collageRows`): at most `columns`
 * cards in a row on a wide screen, two on a tablet, one or two on a phone,
 * the lead counting two. The card is the theme's box (`gf-pane`, ruled or
 * filled by `surface_style`); hovering it eases the photo in a little
 * (none under reduced motion); nothing hides behind a hover.
 */
export function CategoryCollage({
  id,
  title,
  view,
  all,
  t,
  marks,
  ownAll = false,
}: {
  id: string
  title: string
  view: CategoryCollageView
  /** The link beside the head: the shop's own, else every category. */
  all: LinkView
  t?: Translate
  /** The editor's live preview (adr/0065 Faz 2b): the title carries its field mark. */
  marks?: boolean | undefined
  /** `all` is the shop's own link (`more`): in the preview it is marked too. */
  ownAll?: boolean
}) {
  const desktop = collageRows(view.cards.length, view.lead, view.columns)
  const pairs = collageRows(view.cards.length, view.lead, 2)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap-s)">
      <Container className="flex flex-col gap-6 lg:gap-10">
        <SectionHead id={id} title={title} more={all} marks={marks} ownMore={ownAll} />
        <ul className="gf-collage grid grid-cols-12 gap-(--gap-columns)" data-height={view.height}>
          {view.cards.map((card, index) => {
            const tablet = half(pairs[index]?.span ?? 12)
            const phone = view.phoneColumns === 2 ? tablet : 12
            const spans = { desktop: desktop[index]?.span ?? 12, tablet, phone }
            const lead = view.lead && index === 0 && view.cards.length > 1
            return (
              <li
                key={card.path}
                className={cn("min-w-0", PHONE[phone], TABLET[tablet], DESKTOP[spans.desktop])}
              >
                <Card
                  card={card}
                  lead={lead}
                  leadRow={view.lead && view.cards.length > 1 && desktop[index]?.row === 0}
                  spans={spans}
                  t={t}
                />
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
