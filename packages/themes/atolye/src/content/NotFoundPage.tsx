import { Search } from "lucide-react"
import type { NotFoundPageView, Translate } from "@qticaret/ui"
import { TileGrid } from "../listing/CategoryTiles"
import { Container } from "../parts/Container"

/**
 * A page that is not there (404; the status code is the storefront's):
 * on a graphite stage the number set huge and quiet, the title, one line
 * and the search as the way on (a plain GET to `/arama`, the stage's own
 * field and button), the way home beside it; under the stage the shop's
 * categories as picture tiles (owner 2026-11-05: categories are always
 * pictures), so a lost visitor is one tap from an aisle.
 */
export function NotFoundPage({ t, view }: { t: Translate; view?: NotFoundPageView }) {
  const categories = view?.categories ?? []
  return (
    <Container className="flex flex-col gap-(--section-gap-s) pt-6 lg:pt-10">
      <section
        aria-labelledby="bulunamadi"
        className="gf-stage grid gap-8 overflow-hidden rounded-tile p-6 sm:p-10 lg:grid-cols-12 lg:gap-(--gap-columns) lg:p-16"
      >
        <p
          aria-hidden="true"
          className="tabular text-[clamp(5rem,12vw,11rem)] leading-[0.85] font-extrabold tracking-(--tracking-display) text-transparent [-webkit-text-stroke:2px_var(--color-stage-text-2)] lg:order-2 lg:col-span-5 lg:self-end lg:text-right"
        >
          404
        </p>
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
          <h1 id="bulunamadi">{t("not_found.title")}</h1>
          <p className="max-w-[44ch] text-stage-text-2 lg:text-lead">{t("not_found.lead")}</p>
          <form
            action="/arama"
            method="get"

            className="flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="bulunamadi-ara" className="sr-only">
              {t("search.label")}
            </label>
            <input
              id="bulunamadi-ara"
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
