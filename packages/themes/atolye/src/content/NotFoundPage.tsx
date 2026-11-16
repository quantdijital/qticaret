import { Search } from "lucide-react"
import type { NotFoundPageView, Translate } from "@qticaret/ui"
import { TileGrid } from "../listing/CategoryTiles"
import { Container } from "../parts/Container"

/** What tells a missing page from a removed one: the number set huge, the title and the line. */
const WORDS = {
  missing: { number: "404", title: "not_found.title", lead: "not_found.lead" },
  gone: { number: "410", title: "gone.title", lead: "gone.lead" },
} as const

/**
 * A page that is not there, missing (404) or removed for good (410); the
 * status code is the storefront's. On a graphite stage the number set
 * huge and quiet, the title, one line and the search as the way on (a
 * plain GET to `/arama`, the stage's own field and button), the way home
 * beside it; under the stage the shop's categories as picture tiles
 * (owner 2026-11-05: categories are always pictures), so a lost visitor
 * is one tap from an aisle.
 */
function MissingPage({
  t,
  view,
  kind,
}: {
  t: Translate
  view: NotFoundPageView | undefined
  kind: keyof typeof WORDS
}) {
  const categories = view?.categories ?? []
  const words = WORDS[kind]
  const id = kind === "gone" ? "kaldirildi" : "bulunamadi"
  return (
    <Container className="flex flex-col gap-(--section-gap) pt-6 lg:pt-10">
      <section
        aria-labelledby={id}
        className="gf-stage grid gap-8 overflow-hidden rounded-tile p-6 sm:p-10 lg:grid-cols-12 lg:gap-(--gap-columns) lg:p-16"
      >
        <p
          aria-hidden="true"
          className="tabular text-[clamp(4rem,7vw,7.5rem)] leading-[0.85] font-extrabold tracking-(--tracking-display) text-transparent [-webkit-text-stroke:2px_var(--color-stage-text-2)] lg:order-2 lg:col-span-5 lg:self-end lg:text-right"
        >
          {words.number}
        </p>
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
          <h1 id={id}>{t(words.title)}</h1>
          <p className="max-w-[44ch] text-stage-text-2 lg:text-lead">{t(words.lead)}</p>
          <form action="/arama" method="get" className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor={`${id}-ara`} className="sr-only">
              {t("search.label")}
            </label>
            <input
              id={`${id}-ara`}
              type="search"
              name="q"
              required
              placeholder={t("search.placeholder")}
              autoComplete="off"
              enterKeyHint="search"
              className="gf-field min-w-0 sm:flex-1"
            />
            <button type="submit" className="gf-btn">
              <Search className="size-5" aria-hidden="true" strokeWidth={1.75} />
              {t("search.submit")}
            </button>
          </form>
          <p>
            <a href="/" className="gf-link">
              {t("not_found.home")}
            </a>
          </p>
        </div>
      </section>
      {categories.length > 0 && (
        <TileGrid
          id="kategorilere-goz-atin"
          title={t("not_found.categories")}
          categories={categories}
        />
      )}
    </Container>
  )
}

/** A 404: the address is not, or no longer, a page here. */
export function NotFoundPage({ t, view }: { t: Translate; view?: NotFoundPageView }) {
  return <MissingPage t={t} view={view} kind="missing" />
}

/**
 * A 410 (adr/0046 Ek 2026-11-05): the 404's sibling for a page the shop
 * removed for good, "Bu sayfa kaldırıldı", the same search and tiles.
 */
export function GonePage({ t, view }: { t: Translate; view?: NotFoundPageView }) {
  return <MissingPage t={t} view={view} kind="gone" />
}
