import { ResponsiveImage } from "@qticaret/ui"
import type { BrandLinkView, BrandsPageView, Translate } from "@qticaret/ui"
import { Container } from "./parts/Container"
import { Trail } from "./parts/Trail"

/**
 * A brand as a filled tile: its logo on a white plate when it has one, its
 * name; one link. The plate is 40 px tall and as wide as its logo at that
 * height, from a 40 px square (a square logo's, as before) up to 120 px
 * (a 3:1 wordmark whole); a logo wider still keeps its ratio, lower. The
 * name keeps its line first: where the tile is narrow the plate gives way
 * down to the square, its logo smaller, and only then does the name wrap
 * (as it did beside the square).
 */
function BrandTile({ brand }: { brand: BrandLinkView }) {
  return (
    <a
      href={brand.path}
      className="flex min-h-16 min-w-0 items-center gap-3 rounded-media gf-pane p-3 transition-colors duration-(--dur-micro) hover:bg-paper-3"
    >
      {brand.logo && (
        <span className="gf-logo-plate flex h-10 max-w-30 min-w-10 items-center justify-center overflow-hidden rounded-inner bg-field">
          <ResponsiveImage
            image={brand.logo}
            sizes="120px"
            className="max-h-10 max-w-full object-contain"
          />
        </span>
      )}
      <span
        className={
          brand.logo
            ? "max-w-[calc(100%-3.25rem)] min-w-0 shrink-0 text-md font-semibold break-words"
            : "min-w-0 text-md font-semibold break-words"
        }
      >
        {brand.label}
      </span>
    </a>
  )
}

/**
 * Every brand (`/markalar`): the trail and title, the letters as pill
 * jump links, then a section per letter with its brands as filled tiles.
 * All links, no script.
 */
export function BrandsPage({ view, t }: { view: BrandsPageView; t: Translate }) {
  return (
    <Container className="pt-4 lg:pt-6">
      <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} />
      <h1 className="mt-4 lg:mt-6">{view.title}</h1>
      {view.groups.length === 0 ? (
        <p className="mt-8 rounded-tile gf-pane px-6 py-12 text-center text-text-2">
          {t("brands.empty")}
        </p>
      ) : (
        <>
          <nav aria-label={t("brands.letters")} className="mt-6 lg:mt-8">
            <ul className="flex flex-wrap gap-2">
              {view.groups.map((group) => (
                <li key={group.anchor}>
                  <a
                    href={`#${group.anchor}`}
                    className="gf-chip min-w-11 justify-center font-semibold"
                  >
                    {group.letter}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-8 flex flex-col gap-10 lg:mt-10 lg:gap-12">
            {view.groups.map((group) => (
              <section
                key={group.anchor}
                aria-labelledby={group.anchor}
                className="flex scroll-mt-40 flex-col gap-4"
              >
                <h2 id={group.anchor} className="scroll-mt-40">
                  {group.letter}
                </h2>
                <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {group.brands.map((brand) => (
                    <li key={brand.path} className="min-w-0">
                      <BrandTile brand={brand} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </Container>
  )
}
