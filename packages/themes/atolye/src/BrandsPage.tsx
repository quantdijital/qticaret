import { ResponsiveImage } from "@qticaret/ui"
import type { BrandLinkView, BrandsPageView, Translate } from "@qticaret/ui"
import { Container } from "./parts/Container"
import { Trail } from "./parts/Trail"

/** A brand as a filled tile: its logo on a white plate when it has one, its name; one link. */
function BrandTile({ brand }: { brand: BrandLinkView }) {
  return (
    <a
      href={brand.path}
      className="flex min-h-16 min-w-0 items-center gap-3 rounded-media bg-paper-2 p-3 transition-colors duration-(--dur-micro) hover:bg-paper-3"
    >
      {brand.logo && (
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-inner bg-field">
          <ResponsiveImage
            image={brand.logo}
            sizes="40px"
            className="max-h-10 max-w-10 object-contain"
          />
        </span>
      )}
      <span className="min-w-0 text-md font-semibold break-words">{brand.label}</span>
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
        <p className="mt-8 rounded-tile bg-paper-2 px-6 py-12 text-center text-text-2">
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
