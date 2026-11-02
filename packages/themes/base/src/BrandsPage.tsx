import { ResponsiveImage } from "@qticaret/ui"
import type { BrandLinkView, BrandsPageView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"

/** A brand as a tile: its logo when it has one, its name; one link. */
function BrandTile({ brand }: { brand: BrandLinkView }) {
  return (
    <a
      href={brand.path}
      className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-foreground"
    >
      {brand.logo && (
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <ResponsiveImage
            image={brand.logo}
            sizes="40px"
            className="max-h-10 max-w-10 object-contain"
          />
        </span>
      )}
      <span className="min-w-0 text-sm font-medium break-words">{brand.label}</span>
    </a>
  )
}

/**
 * Every brand (`/markalar`): the letters as jump links, then a section per
 * letter with its brands as tiles. All links, no script.
 */
export function BrandsPage({ view, t }: { view: BrandsPageView; t: Translate }) {
  return (
    <PageContainer className="flex flex-col gap-8">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <h1 className="text-4xl leading-tight lg:text-5xl">{view.title}</h1>
      {view.groups.length === 0 ? (
        <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
          {t("brands.empty")}
        </p>
      ) : (
        <>
          <nav aria-label={t("brands.letters")}>
            <ul className="flex flex-wrap gap-1.5">
              {view.groups.map((group) => (
                <li key={group.anchor}>
                  <a
                    href={`#${group.anchor}`}
                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border bg-card px-3 text-sm font-semibold transition-colors hover:bg-foreground hover:text-background"
                  >
                    {group.letter}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-10">
            {view.groups.map((group) => (
              <section
                key={group.anchor}
                aria-labelledby={group.anchor}
                className="flex scroll-mt-40 flex-col gap-4"
              >
                <h2 id={group.anchor} className="scroll-mt-40 border-b pb-2 text-3xl">
                  {group.letter}
                </h2>
                <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
    </PageContainer>
  )
}
