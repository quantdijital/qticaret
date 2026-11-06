import { ArrowRight } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CategoriesPageView, CategoryTreeView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "./parts/Container"
import { CategoryTile } from "./parts/CategoryTile"
import { Trail } from "./parts/Trail"

/** A count in Turkish digits ("1.240"). */
const digits = (count: number) => count.toLocaleString("tr-TR")

/** "24 ürün" under a name; nothing for an empty or uncounted category. */
const countOf = (category: CategoryTreeView, t: Translate) =>
  category.count ? t("listing.count", { count: digits(category.count) }) : null

/** Every category the page shows, at every depth it draws. */
const listedCount = (categories: readonly CategoryTreeView[]) =>
  categories.reduce((sum, top) => sum + 1 + top.children.length, 0)

/**
 * One section's tiles in one row that scrolls sideways (two and a half
 * on a phone, four and a half from 640 px, as above a listing's grid; six
 * and a half from 1024 px), from 1280 px a grid of eight: a section is
 * one row of tiles the listing page's size.
 */
function Tiles({ categories, t }: { categories: readonly CategoryTreeView[]; t: Translate }) {
  return (
    <ul
      className={cn(
        "gf-rail -mx-(--gutter) -my-1 grid auto-cols-[40%] grid-flow-col gap-(--gap-columns) overflow-x-auto scroll-px-(--gutter) px-(--gutter) py-1 sm:auto-cols-[22%]",
        "lg:mx-0 lg:auto-cols-[calc((100%_-_6*var(--gap-columns))/6.5)] lg:scroll-px-0 lg:px-0",
        "xl:my-0 xl:auto-cols-auto xl:grid-flow-row xl:grid-cols-8 xl:overflow-visible xl:py-0"
      )}
    >
      {categories.map((category) => (
        <li key={category.path} className="min-w-0">
          <CategoryTile
            category={category}
            compact
            note={countOf(category, t)}
            sizes="(min-width: 1440px) 150px, (min-width: 1280px) 10vw, (min-width: 1024px) 13vw, (min-width: 640px) 22vw, 40vw"
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * A top category with the ones below it: its head (its picture small,
 * its name as the section's heading, its count; "Tümünü gör" to its page
 * on the same line), then the ones below it as tiles.
 */
function Branch({ top, t }: { top: CategoryTreeView; t: Translate }) {
  // The page's last step ("/kategori/cakilar" → "kategori-cakilar"): an anchor to the section
  const id = `kategori-${top.path.split("/").filter(Boolean).at(-1) ?? "ust"}`
  const count = countOf(top, t)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 lg:gap-5">
      <div className="flex items-center justify-between gap-4">
        <a href={top.path} className="group flex min-w-0 items-center gap-3 no-underline">
          {top.image && (
            <span className="gf-stage relative size-12 shrink-0 overflow-hidden rounded-inner">
              <ResponsiveImage
                image={{ ...top.image, alt: "" }}
                sizes="48px"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <h2 id={id} className="underline-offset-4 group-hover:underline">
              {top.label}
            </h2>
            {count && <span className="text-sm text-text-3">{count}</span>}
          </span>
        </a>
        <a
          href={top.path}
          aria-label={t("nav.see_all", { name: top.label })}
          className="gf-link shrink-0 text-sm lg:text-md"
        >
          {t("categories.see_all")}
          <ArrowRight className="size-4" aria-hidden="true" strokeWidth={2} />
        </a>
      </div>
      <Tiles categories={top.children} t={t} />
    </section>
  )
}

/**
 * Every category (`/kategoriler`, design.md § Kategoriler sayfası): the
 * trail, the title and one line of what the shop holds; then each top
 * category with categories below it as a section of picture tiles, one
 * row each, and the top categories with none below them together as one
 * last row of tiles ("Diğer kategoriler"), so no box stands half empty.
 * Every category is a picture tile with its count; all of it in the
 * first HTML.
 */
export function CategoriesPage({ view, t }: { view: CategoriesPageView; t: Translate }) {
  const branches = view.categories.filter((top) => top.children.length > 0)
  const leaves = view.categories.filter((top) => top.children.length === 0)
  const listed = listedCount(view.categories)
  const lead =
    typeof view.total === "number" && view.total > 0
      ? t("categories.lead", { products: digits(view.total), count: digits(listed) })
      : t("categories.lead_count", { count: digits(listed) })
  return (
    <Container className="pt-4 lg:pt-6">
      <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} />
      <header className="mt-4 flex flex-col gap-2 lg:mt-6">
        <h1>{view.title}</h1>
        {listed > 0 && <p className="text-md text-text-2 lg:text-lead">{lead}</p>}
      </header>
      {listed === 0 ? (
        <p className="mt-8 rounded-tile bg-paper-2 px-6 py-12 text-center text-text-2">
          {t("categories.empty")}
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-10 lg:mt-10 lg:gap-12">
          {branches.map((top) => (
            <Branch key={top.path} top={top} t={t} />
          ))}
          {leaves.length > 0 && (
            <section aria-labelledby="kategori-diger" className="flex flex-col gap-4 lg:gap-5">
              <h2 id="kategori-diger" className={branches.length > 0 ? undefined : "sr-only"}>
                {t(branches.length > 0 ? "categories.others" : "categories.all")}
              </h2>
              <Tiles categories={leaves} t={t} />
            </section>
          )}
        </div>
      )}
    </Container>
  )
}
