import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCollageView, LinkView, LinkedCategoryCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { collageCards } from "./collage-rows"
import type { CollageCard, CollageSpan } from "./collage-rows"
import { SectionHead } from "./SectionHead"

/** A card's width in twelfths at each screen, written whole for Tailwind. */
const PHONE: Record<6 | 12, string> = { 6: "col-span-6", 12: "col-span-12" }
const TABLET: Record<6 | 12, string> = { 6: "sm:col-span-6", 12: "sm:col-span-12" }
const LG: Record<CollageSpan, string> = {
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
}
const XL: Record<CollageSpan, string> = {
  3: "xl:col-span-3",
  4: "xl:col-span-4",
  6: "xl:col-span-6",
  8: "xl:col-span-8",
  12: "xl:col-span-12",
}

/** The share of the page a span of twelve shows, for the photo's `sizes`. */
const vw = (span: number) => `${String(Math.round((span / 12) * 92))}vw`

/** How wide the photo shows at each screen. */
const sizesOf = (place: CollageCard): string =>
  `(min-width: 1280px) ${vw(place.xl)}, (min-width: 1024px) ${vw(place.lg)}, ` +
  `(min-width: 640px) ${vw(place.tablet)}, ${vw(place.phone)}`

function Card({
  card,
  place,
  t,
}: {
  card: LinkedCategoryCardView
  place: CollageCard
  t?: Translate | undefined
}) {
  const picture = card.image ?? null
  return (
    <article
      className="gf-collage-card gf-pane relative flex h-full min-w-0 flex-col rounded-tile p-2"
      {...(place.lead ? { "data-lead": "" } : {})}
      {...(place.alone.length > 0 ? { "data-alone": place.alone.join(" ") } : {})}
    >
      <div className="gf-collage-photo overflow-hidden rounded-media bg-media">
        {picture ? (
          <ResponsiveImage
            image={{ ...picture, alt: "" }}
            sizes={sizesOf(place)}
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
      <div className="gf-collage-words flex min-w-0 flex-col px-2 pt-3 pb-1 sm:px-3 sm:pt-4">
        <h3
          className={cn(
            "leading-tight font-extrabold tracking-[-0.015em] break-words text-balance",
            place.lead ? "text-section lg:text-display" : "text-title"
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
          <p className="mt-1 text-sm font-semibold text-text-3 tabular-nums">
            {t("listing.count", { count: card.count.toLocaleString("tr-TR") })}
          </p>
        )}
      </div>
      {card.children.length > 0 && <Children links={card.children} />}
    </article>
  )
}

/** The first subcategories, quiet words in one wrapping line, each its own stop above the card's link. */
function Children({ links }: { links: LinkView[] }) {
  return (
    <ul className="gf-collage-links relative z-[1] flex flex-wrap gap-x-4 px-2 pb-1 sm:mt-1 sm:px-3">
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
 * step, the lead's a third taller where it stands alone in its row), its
 * name in 800 under it, its
 * count and its first subcategories as quiet links that wrap. The whole
 * card links to the category; the subcategories are their own stops.
 * Rows fill edge to edge (`collageCards`): one or two cards a row on a
 * phone, two on a tablet, at most three from 1024 px and the shop's
 * `columns` from 1280 px, the lead counting two. The card is the theme's
 * box (`gf-pane`, ruled or filled by `surface_style`); hovering it eases
 * the photo in a little (none under reduced motion); nothing hides
 * behind a hover.
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
  const places = collageCards(
    view.cards.length,
    view.lead,
    view.columns,
    view.phoneColumns === 2 ? 2 : 1
  )
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container className="flex flex-col gap-(--head-gap)">
        <SectionHead id={id} title={title} more={all} marks={marks} ownMore={ownAll} />
        <ul
          className="gf-collage grid grid-cols-12 gap-(--gap-columns)"
          data-height={view.height}
          {...(view.lead && view.phoneColumns !== 2 && view.cards.length > 1
            ? { "data-phone-rows": "" }
            : {})}
        >
          {view.cards.map((card, index) => {
            const place = places[index]
            return place ? (
              <li
                key={card.path}
                className={cn(
                  "min-w-0",
                  PHONE[place.phone],
                  TABLET[place.tablet],
                  LG[place.lg],
                  XL[place.xl]
                )}
              >
                <Card card={card} place={place} t={t} />
              </li>
            ) : null
          })}
        </ul>
      </Container>
    </section>
  )
}
