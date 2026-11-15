import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView, HeroCatalogView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

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
        <span className="gf-mosaic-thumb bg-media-deep">
          {category.image && (
            <ResponsiveImage
              image={{ ...category.image, alt: "" }}
              sizes="40px"
              className="h-full w-full object-cover"
            />
          )}
        </span>
        {/* A name wraps rather than losing its end: three lines in a phone's narrow cell (K-15) */}
        <span className="line-clamp-3 leading-snug break-words">{category.label}</span>
        {typeof category.count === "number" ? <Count count={category.count} t={t} /> : <span />}
      </a>
    </li>
  )
}

/** The shop's category list in its steel well, and the link to every category. */
export function CatalogList({ catalog, t }: { catalog: HeroCatalogView; t: Translate }) {
  return (
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

/** The two category tiles beside the opening. */
export function CatalogTiles({ catalog, t }: { catalog: HeroCatalogView; t: Translate }) {
  return (
    <div className="gf-mosaic-side">
      {catalog.tiles.map((category) => (
        <SideTile key={category.path} category={category} t={t} />
      ))}
    </div>
  )
}

/** The quick links under the opening: one row that scrolls on a phone, wrapping from 768 px. */
export function CatalogChips({ catalog, t }: { catalog: HeroCatalogView; t: Translate }) {
  return (
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
  )
}
