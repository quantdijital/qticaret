import { Fragment } from "react"
import type { LinkView, ListingPageView, SearchHelpView, Translate } from "@qticaret/ui"
import { TileGrid, TileRail } from "./CategoryTiles"

/** "Bunu mu demek istediniz: çakı, bıçak": each phrase its own search. */
export function DidYouMean({ suggestions, t }: { suggestions: LinkView[]; t: Translate }) {
  if (suggestions.length === 0) {
    return null
  }
  return (
    <p className="text-lead text-text-2">
      {t("search.did_you_mean")}{" "}
      {suggestions.map((suggestion, index) => (
        <Fragment key={suggestion.path}>
          {index > 0 && ", "}
          <a
            href={suggestion.path}
            className="font-extrabold text-text underline underline-offset-4"
          >
            {suggestion.label}
          </a>
        </Fragment>
      ))}
    </p>
  )
}

/**
 * A search's help above its results: "did you mean" phrases, the
 * categories most results are in as picture tiles (owner: categories are
 * never chips), and the brands that narrow the search (a filter, so
 * nofollow) as quiet pills.
 */
export function SearchHelp({ help, t }: { help: SearchHelpView; t: Translate }) {
  return (
    <div className="flex flex-col gap-8">
      <DidYouMean suggestions={help.suggestions} t={t} />
      <TileRail
        id="ilgili-kategoriler"
        title={t("search.related_categories")}
        categories={help.categories}
        visibleTitle
      />
      {help.brands.length > 0 && (
        <section aria-labelledby="ilgili-markalar" className="flex flex-col gap-3">
          <h2 id="ilgili-markalar" className="text-title">
            {t("search.related_brands")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {help.brands.map((brand) => (
              <li key={brand.path}>
                <a href={brand.path} rel="nofollow" className="gf-chip">
                  {brand.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * A list with nothing in it, and a way out. Narrowed too far: say so and
 * offer to clear every filter. A search that found nothing (or was not
 * asked yet): the words, the phrases the catalogue spells, the shop's
 * categories as tiles and the whole catalogue. Any other empty list: its
 * words, the whole catalogue and the categories.
 */
export function Empty({ view, t }: { view: ListingPageView; t: Translate }) {
  const help = view.search ?? null
  if (view.active.length > 0) {
    return (
      <div className="flex flex-col items-start gap-5 rounded-tile bg-paper-2 p-6 lg:p-10">
        <p className="max-w-[48ch] text-title font-extrabold tracking-[-0.015em]">
          {t("listing.no_match")}
        </p>
        {view.clearPath && (
          <a href={view.clearPath} rel="nofollow" className="gf-btn">
            {t("listing.clear_filters")}
          </a>
        )}
      </div>
    )
  }
  // A search's own words come as its description (nothing asked yet, words it cannot read)
  const words = view.empty ?? (help ? view.description[0] : undefined) ?? t("listing.empty")
  const popular = help?.popular ?? []
  return (
    <div className="flex flex-col gap-(--space-2xl)">
      <div className="flex flex-col items-start gap-5 rounded-tile bg-paper-2 p-6 lg:p-10">
        <p className="max-w-[48ch] text-title font-extrabold tracking-[-0.015em]">{words}</p>
        {help && <DidYouMean suggestions={help.suggestions} t={t} />}
        <p className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <a href="/magaza" className="gf-btn">
            {t("listing.browse_all")}
          </a>
          {popular.length === 0 && (
            <a href="/kategoriler" className="gf-link">
              {t("search.suggest.browse")}
            </a>
          )}
        </p>
      </div>
      <TileGrid
        id="kategorilere-goz-atin"
        title={t("search.suggest.browse")}
        categories={popular}
      />
    </div>
  )
}
