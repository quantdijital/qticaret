import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView, HeroCatalogView, ProductCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Preload } from "../parts/Preload"
import { type Of, headingId } from "./plan"

const SIZES = "(min-width: 1024px) 26vw, (min-width: 768px) 50vw, 100vw"

/** The opening's variants this theme draws (`drawnVariant`): today's and the category list. */
export const HERO_VARIANTS = ["standard", "category_list"] as const

/** A count in Turkish digits ("1.240"). */
const digits = (count: number) => count.toLocaleString("tr-TR")

/** "58" in a pill, "58 ürün" for a screen reader. */
function Count({ count, t }: { count: number; t: Translate }) {
  return (
    <span className="gf-mosaic-count">
      <span aria-hidden="true">{digits(count)}</span>
      <span className="sr-only">{t("listing.count", { count: digits(count) })}</span>
    </span>
  )
}

/** One row of the list: the category's small picture, its name and its count. */
function ListRow({ category, t }: { category: CategoryCardView; t: Translate }) {
  return (
    <li>
      <a href={category.path} className="gf-mosaic-row">
        <span className="gf-mosaic-thumb">
          {category.image && (
            <ResponsiveImage
              image={{ ...category.image, alt: "" }}
              sizes="40px"
              className="h-full w-full object-cover"
            />
          )}
        </span>
        {/* A name wraps to a second line rather than losing its end (K-15) */}
        <span className="line-clamp-2 leading-snug break-words">{category.label}</span>
        {typeof category.count === "number" ? <Count count={category.count} t={t} /> : <span />}
      </a>
    </li>
  )
}

/** A category tile beside the opening: its picture, its name and count on the graphite foot. */
function SideTile({ category, t }: { category: CategoryCardView; t: Translate }) {
  return (
    <a href={category.path} className="gf-mosaic-tile group">
      {category.image && (
        <ResponsiveImage
          image={{ ...category.image, alt: "" }}
          sizes="(min-width: 1024px) 18vw, 50vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span className="relative z-(--z-raised) flex flex-col gap-0.5 p-3 sm:p-4">
        <span className="leading-tight font-extrabold underline-offset-4 group-hover:underline">
          {category.label}
        </span>
        {typeof category.count === "number" && (
          <span className="text-xs font-semibold text-stage-text-2">
            {t("listing.count", { count: digits(category.count) })}
          </span>
        )}
      </span>
    </a>
  )
}

/**
 * The catalogue opening, H17 (adr/0049 Ek 2026-11-14 §3.2; design.md §
 * Katalog açılışı): the shop's category list with each one's picture and
 * product count, the opening as the middle tile (heading, line, the
 * lowest price of the products shown small, the buttons, the products
 * small with the shop's labels, the picture), two category tiles, and the
 * quick links under them. The heading is the page's h1 when the opening
 * comes first and its picture the LCP; the picture is the opening's own,
 * else the shop's newest pictured product. No script; nothing moves.
 */
export function HeroCatalog({
  hero,
  catalog,
  product,
  first,
  t,
}: {
  hero: Of<"hero">
  catalog: HeroCatalogView
  product: ProductCardView | null
  first: boolean
  t: Translate
}) {
  const id = headingId(hero.id)
  const [action, second] = hero.actions
  // The shop's own picture keeps the words it wrote; a stand-in product photo says nothing
  const image = hero.image ?? (product?.image ? { ...product.image, alt: "" } : null)
  const Heading = first ? "h1" : "h2"
  return (
    <section aria-labelledby={id} className="pt-3 lg:pt-6">
      {first && image && <Preload image={image} sizes={SIZES} />}
      <Container>
        <div className="gf-mosaic">
          <article className="gf-mosaic-feature">
            <div className="flex flex-col items-start justify-center gap-4 p-5 sm:p-8 lg:gap-5 lg:p-10">
              {hero.eyebrow && <p className="text-sm font-semibold text-text-2">{hero.eyebrow}</p>}
              <Heading
                id={id}
                className="max-w-[18ch] text-hero leading-[1.08] tracking-(--tracking-display)"
              >
                {hero.heading}
              </Heading>
              {hero.intro && <p className="max-w-[44ch] text-lead text-text-2">{hero.intro}</p>}
              {catalog.from && (
                <p className="flex items-baseline gap-2">
                  <b className="text-price font-extrabold tabular-nums">{catalog.from}</b>
                  <span className="text-sm text-text-3">{t("home.hero_from")}</span>
                </p>
              )}
              {action && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href={action.path} className="gf-btn">
                    {action.label}
                  </a>
                  {second && (
                    <a href={second.path} className="gf-btn gf-btn--quiet">
                      {second.label}
                    </a>
                  )}
                </div>
              )}
              {catalog.picks.length > 0 && (
                <ul aria-label={t("home.hero_picks")} className="flex flex-wrap gap-2 pt-1">
                  {catalog.picks.map((pick) => (
                    <li key={pick.path}>
                      <a
                        href={pick.path}
                        className="gf-mosaic-swatch grid w-16 justify-items-center gap-1 text-center text-2xs font-semibold text-text-2 no-underline"
                      >
                        <span className="block size-14 overflow-hidden rounded-inner">
                          {pick.image && (
                            <ResponsiveImage
                              image={pick.image}
                              sizes="56px"
                              className="h-full w-full rounded-inner object-cover"
                            />
                          )}
                        </span>
                        <span className="line-clamp-2">{pick.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {image && (
              <div className="gf-mosaic-photo">
                <ResponsiveImage
                  image={image}
                  sizes={SIZES}
                  priority={first}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            )}
          </article>
          {catalog.list.length > 0 && (
            <nav aria-label={t("home.hero_categories")} className="gf-mosaic-list">
              <ul>
                {catalog.list.map((category) => (
                  <ListRow key={category.path} category={category} t={t} />
                ))}
              </ul>
              <a href={catalog.all.path} className="gf-link mx-2 mt-2 self-start text-sm">
                {catalog.all.label}
              </a>
            </nav>
          )}
          {catalog.tiles.length > 0 && (
            <div className="gf-mosaic-side">
              {catalog.tiles.map((category) => (
                <SideTile key={category.path} category={category} t={t} />
              ))}
            </div>
          )}
        </div>
        {catalog.chips.length > 0 && (
          <ul
            aria-label={t("home.quick_links")}
            className={cn(
              "gf-rail -mx-(--gutter) mt-4 flex gap-2 overflow-x-auto scroll-px-(--gutter) px-(--gutter) py-1 lg:mt-6",
              "md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
            )}
          >
            {catalog.chips.map((chip) => (
              <li key={chip.path} className="shrink-0">
                <a href={chip.path} className={cn("gf-chip", chip.image && "pl-2")}>
                  {chip.image && (
                    <span className="block size-7 overflow-hidden rounded-pill">
                      <ResponsiveImage
                        image={{ ...chip.image, alt: "" }}
                        sizes="28px"
                        className="h-full w-full object-cover"
                      />
                    </span>
                  )}
                  {chip.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  )
}
