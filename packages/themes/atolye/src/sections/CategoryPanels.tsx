import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryPanelsView, LinkView, LinkedCategoryCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { panelPlaces } from "./panel-rows"
import type { PanelPlace } from "./panel-rows"
import { SectionHead } from "./SectionHead"

/** A panel's width in twelfths at each screen and the lead's rows, written whole for Tailwind. */
const PHONE: Record<6 | 12, string> = { 6: "col-span-6", 12: "col-span-12" }
const TABLET: Record<6 | 12, string> = { 6: "sm:col-span-6", 12: "sm:col-span-12" }
const LG: Record<PanelPlace["lg"], string> = {
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
}
const XL: Record<PanelPlace["xl"], string> = {
  3: "xl:col-span-3",
  4: "xl:col-span-4",
  6: "xl:col-span-6",
  8: "xl:col-span-8",
  12: "xl:col-span-12",
}
const ROWS: Record<number, string> = { 2: "lg:row-span-2" }

/** The share of the page a span of twelve shows, for the photo's `sizes`. */
const vw = (span: number, wide: boolean) =>
  `${String(Math.round((span / 12) * (wide ? 42 : 92)))}vw`

/** How wide the photo shows at each screen (a wide panel's photo takes a little under half). */
const sizesOf = (place: PanelPlace): string =>
  `(min-width: 1280px) ${vw(place.xl, place.wide.includes("xl"))}, ` +
  `(min-width: 1024px) ${vw(place.lg, place.wide.includes("lg"))}, ` +
  `(min-width: 640px) ${vw(place.tablet, place.wide.includes("tablet"))}, ` +
  vw(place.phone, place.wide.includes("phone"))

function Panel({
  card,
  place,
  t,
}: {
  card: LinkedCategoryCardView
  place: PanelPlace
  t?: Translate | undefined
}) {
  const picture = card.image ?? null
  return (
    <article
      className="gf-panel relative h-full min-w-0 overflow-hidden rounded-tile bg-stage text-stage-text"
      {...(place.lead ? { "data-lead": "" } : {})}
      {...(place.wide.length > 0 ? { "data-wide": place.wide.join(" ") } : {})}
    >
      <div className="gf-panel-photo relative overflow-hidden bg-stage-2">
        {picture ? (
          <ResponsiveImage
            image={{ ...picture, alt: "" }}
            sizes={sizesOf(place)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // No picture yet: the name's first letter keeps the panel's shape
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center text-figure leading-none font-extrabold text-stage-text-2 opacity-30"
          >
            {card.label.trim().charAt(0).toLocaleUpperCase("tr-TR")}
          </span>
        )}
      </div>
      <div className="gf-panel-words relative flex min-w-0 flex-col">
        <h3
          className={cn(
            "leading-tight font-extrabold tracking-[-0.015em] break-words text-balance",
            place.lead ? "text-section lg:text-display" : "text-title"
          )}
        >
          {/* The whole panel is the category's link: one stop for the keyboard, the panel ringed on focus */}
          <a
            href={card.path}
            className="gf-panel-link no-underline after:absolute after:inset-0 after:content-['']"
          >
            {card.label}
          </a>
        </h3>
        {t && typeof card.count === "number" && (
          <p className="mt-1 text-sm font-semibold text-stage-text-2 tabular-nums">
            {t("listing.count", { count: card.count.toLocaleString("tr-TR") })}
          </p>
        )}
        {card.children.length > 0 && <Children links={card.children} />}
      </div>
    </article>
  )
}

/** The first subcategories in the stage's quiet ink, one wrapping line, each its own stop above the panel's link. */
function Children({ links }: { links: LinkView[] }) {
  return (
    <ul className="relative z-[1] mt-2 flex flex-wrap gap-x-4">
      {links.map((child) => (
        <li key={child.path} className="min-w-0">
          <a
            href={child.path}
            className="flex min-h-11 items-center text-sm break-words text-stage-text-2 no-underline hover:text-stage-text lg:pointer-fine:min-h-8"
          >
            {child.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * The category cards' `panels` variant (adr/0049 Ek 2026-11-19): each
 * category a graphite panel, no frame, led by its photograph, which fades
 * into the graphite where the words begin (the theme's signature: the
 * shop's own photograph merging into the stage). The name in 800, the
 * count and the first subcategories stand on the graphite, never on the
 * photo, so they read at every photo. A tall panel has its photo over the
 * words; a wide one (half the page or more on a wide screen, the whole
 * row under 1024 px) its words beside the photo, so a long, flat product
 * is not cropped to a sliver. While `lead` is on the first panel stands
 * tall on the left from 1024 px, the others stacked beside it
 * (`panelPlaces`); the photo takes the room the words leave, so no panel
 * has an empty foot. The whole panel links to the category; hovering eases
 * the photo in a little (none under reduced motion).
 */
export function CategoryPanels({
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
  view: CategoryPanelsView
  /** The link beside the head: the shop's own, else every category. */
  all: LinkView
  t?: Translate
  /** The editor's live preview (adr/0065 Faz 2b): the title carries its field mark. */
  marks?: boolean | undefined
  /** `all` is the shop's own link (`more`): in the preview it is marked too. */
  ownAll?: boolean
}) {
  const places = panelPlaces(
    view.cards.length,
    view.lead,
    view.columns,
    view.phoneColumns === 2 ? 2 : 1
  )
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container className="flex flex-col gap-(--head-gap)">
        <SectionHead id={id} title={title} more={all} marks={marks} ownMore={ownAll} />
        <ul className="gf-panels grid grid-cols-12 gap-(--gap-columns)" data-height={view.height}>
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
                  XL[place.xl],
                  ROWS[place.rows]
                )}
              >
                <Panel card={card} place={place} t={t} />
              </li>
            ) : null
          })}
        </ul>
      </Container>
    </section>
  )
}
