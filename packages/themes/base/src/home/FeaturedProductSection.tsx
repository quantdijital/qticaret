import { ArrowRight } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { FeaturedProductSectionView, Translate } from "@qticaret/ui"
import { Price } from "../components/Price"
import { SpecHighlights } from "../components/ProductDetails"
import { headingId } from "./SectionHead"

/**
 * One product up close (adr/0046 Ek 2026-11-05): its first picture beside
 * its name, price, headline facts and the shop's line, a link to its page,
 * and below them its spec table in its template's sections. All in the
 * first HTML; the picture waits its turn.
 */
export function FeaturedProductSection({
  section,
  t,
}: {
  section: FeaturedProductSectionView
  t: Translate
}) {
  const id = headingId(section.id)
  const { product } = section
  const image = section.images[0] ?? product.image
  const specs = section.specGroups.flatMap((group) => group.rows)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-10">
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="aspect-card overflow-hidden rounded-3xl border bg-card">
          {image ? (
            <ResponsiveImage
              image={image}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-5">
          <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {section.title ?? t("home.featured")}
          </p>
          <h2 id={id} className="text-3xl leading-tight lg:text-4xl">
            <a href={product.path} className="underline-offset-4 hover:underline">
              {product.title}
            </a>
          </h2>
          {section.subtitle && <p className="text-lg text-muted-foreground">{section.subtitle}</p>}
          {product.price && <Price price={product.price} t={t} size="lg" />}
          <SpecHighlights specs={section.facts} label={t("home.featured_facts")} />
          {section.text && <p className="text-[17px] leading-[1.75]">{section.text}</p>}
          <a
            href={product.path}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-button bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            {t("home.featured_view")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
      {specs.length > 0 && (
        <div className="grid gap-6 border-t pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {section.specGroups.map((group, index) => (
            <div key={group.title ?? `-${String(index)}`} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                {group.title ?? t("product.specs")}
              </h3>
              <dl className="overflow-hidden rounded-2xl border bg-card text-sm">
                {group.rows.map((spec) => (
                  <div
                    key={spec.label}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-b px-4 py-3 last:border-b-0"
                  >
                    <dt className="text-muted-foreground">{spec.label}</dt>
                    <dd className="font-medium">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
