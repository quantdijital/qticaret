import { ArrowRight } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type {
  CategoriesVariant,
  CategoryCardsView,
  LinkView,
  LinkedCategoryCardView,
  Translate,
} from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { SectionHead } from "./SectionHead"

/** The category cards' variants this theme draws (`drawnVariant`). */
export const CATEGORY_VARIANTS = ["tiles", "linked"] as const satisfies readonly CategoriesVariant[]

/**
 * Cards in a row from 1024 px, the shop's choice; two from 640 px; one on a
 * phone, or two when the shop asks (`phoneColumns`). Written whole for Tailwind.
 */
const COLUMNS: Record<CategoryCardsView["columns"], string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-3 xl:grid-cols-4",
}

/** How wide a card shows, for an above picture's `sizes`. */
const SIZES: Record<CategoryCardsView["columns"], string> = {
  2: "(min-width: 1024px) 45vw, (min-width: 640px) 45vw, 90vw",
  3: "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw",
  4: "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw",
}

/** The above picture's `sizes`: half the phone's width when two stand in a row there. */
const sizesOf = (view: CategoryCardsView): string =>
  view.phoneColumns === 2 ? SIZES[view.columns].replace(/90vw$/, "45vw") : SIZES[view.columns]

const LINK =
  "flex min-h-11 items-center text-sm text-text-2 no-underline underline-offset-4 hover:text-text hover:underline lg:pointer-fine:min-h-8"

function Card({
  card,
  view,
  t,
}: {
  card: LinkedCategoryCardView
  view: CategoryCardsView
  t?: Translate | undefined
}) {
  const picture = view.imagePosition !== "none" ? (card.image ?? null) : null
  const side = picture !== null && view.imagePosition === "side"
  return (
    <article
      className={cn(
        "flex h-full min-w-0 gap-4",
        side ? "flex-row items-start" : "flex-col",
        view.frame === "lined" && "rounded-tile border border-rule bg-field p-4 sm:p-5"
      )}
    >
      {picture && (
        // The same page as the name: decoration, not a second stop for the keyboard
        <a
          href={card.path}
          tabIndex={-1}
          aria-hidden="true"
          className={cn(
            "block shrink-0 overflow-hidden rounded-media bg-paper-2",
            side ? "size-20 sm:size-24" : "aspect-[4/3] w-full"
          )}
        >
          <ResponsiveImage
            image={{ ...picture, alt: "" }}
            sizes={side ? "96px" : sizesOf(view)}
            className="h-full w-full object-cover"
          />
        </a>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-md leading-tight font-extrabold tracking-[-0.01em] text-balance">
          <a href={card.path} className="no-underline underline-offset-4 hover:underline">
            {card.label}
          </a>
        </h3>
        {t && typeof card.count === "number" && (
          <p className="mt-1 text-xs font-semibold text-text-3">
            {t("listing.count", { count: card.count.toLocaleString("tr-TR") })}
          </p>
        )}
        {card.children.length > 0 && (
          <ul className="mt-2 flex flex-col">
            {card.children.map((child) => (
              <li key={child.path} className="min-w-0">
                <a href={child.path} className={cn(LINK, "break-words")}>
                  {child.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        {card.all && <SeeAll link={card.all} name={card.label} />}
      </div>
    </article>
  )
}

/** "Tümünü gör" with the category's name for a screen reader (each card's is its own). */
function SeeAll({ link, name }: { link: LinkView; name: string }) {
  return (
    <a
      href={link.path}
      className="gf-link mt-2 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold lg:pointer-fine:min-h-8"
    >
      {link.label}
      <span className="sr-only">: {name}</span>
      <ArrowRight className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
    </a>
  )
}

/**
 * The category cards' `linked` variant (adr/0049 Ek 2026-11-15), a
 * catalogue's index: each category a card with its picture (a small
 * square beside the words, a 4:3 picture above them, or none), its name
 * in 800, its count when the shop shows counts, its first subcategories
 * as quiet links and "Tümünü gör" to its own page. Cards stand in a grid:
 * one column on a phone, two from 640 px, the shop's two to four from
 * 1024 px (four from 1280, three between). A card is framed by a hairline
 * on the field colour (`--radius-tile`), or plain on the page; nothing
 * scrolls sideways and long names break.
 */
export function CategoryCards({
  id,
  title,
  view,
  all,
  t,
}: {
  id: string
  title: string
  view: CategoryCardsView
  /** The link beside the head: the shop's own, else every category. */
  all: LinkView
  t?: Translate
}) {
  return (
    <section aria-labelledby={id} className="pt-(--section-gap-s)">
      <Container className="flex flex-col gap-6 lg:gap-10">
        <SectionHead id={id} title={title} more={all} />
        <ul
          className={cn(
            view.phoneColumns === 2 ? "grid grid-cols-2" : "grid grid-cols-1 sm:grid-cols-2",
            view.frame === "lined" ? "gap-(--gap-columns)" : "gap-x-(--gap-columns) gap-y-8",
            COLUMNS[view.columns]
          )}
        >
          {view.cards.map((card) => (
            <li key={card.path} className="min-w-0">
              <Card card={card} view={view} t={t} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
