import { ResponsiveImage } from "@qticaret/ui"
import type { FormAction, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Price } from "../parts/Price"
import { quickAddWords } from "../parts/ProductCard"
import { QuickAdd } from "../parts/QuickAdd"
import { type Of, headingId } from "./plan"

/**
 * One product up close (`featured_product`), on a graphite stage like the
 * opening but mirrored: its photographs (the first large, two more
 * beside it from 1024 px) on the left, then its name, the shop's line, the
 * facts the shop marked as headline ones as rows, the price large and one
 * action: the quick add when it can go straight in, else its page.
 */
export function Spotlight({
  section,
  t,
  quickAdd,
}: {
  section: Of<"featured_product">
  t: Translate
  quickAdd?: FormAction | undefined
}) {
  const { product } = section
  const id = headingId(section.id)
  const pictures = section.images.length > 0 ? section.images : product.image ? [product.image] : []
  const [main, ...more] = pictures
  const extra = more.slice(0, 2)
  const add = quickAdd && product.quickAdd && product.available ? product.quickAdd : null
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container>
        <div className="gf-stage grid gap-6 overflow-hidden rounded-tile p-3 sm:p-4 lg:grid-cols-12 lg:gap-(--gap-columns) lg:p-4">
          {main && (
            <div className="grid gap-3 lg:col-span-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
              <div className="relative aspect-square overflow-hidden rounded-media bg-stage-2">
                <ResponsiveImage
                  image={main}
                  sizes="(min-width: 1024px) 44vw, 100vw"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              {extra.length > 0 && (
                <ul className="hidden gap-3 lg:grid lg:grid-rows-2">
                  {extra.map((image) => (
                    <li
                      key={image.src}
                      className="relative overflow-hidden rounded-media bg-stage-2"
                    >
                      <ResponsiveImage
                        image={image}
                        sizes="14vw"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-col justify-center gap-5 px-2 pb-4 lg:col-span-5 lg:px-8 lg:py-10">
            <h2 id={id} className="text-display text-stage-text">
              {section.title ?? product.title}
            </h2>
            {section.title && <h3 className="text-title text-stage-text">{product.title}</h3>}
            {section.text && <p className="text-stage-text-2">{section.text}</p>}
            {section.facts.length > 0 && (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 text-sm">
                {section.facts.slice(0, 5).map((fact) => (
                  <div key={fact.label} className="contents">
                    <dt className="border-t border-stage-rule py-2 text-stage-text-2">
                      {fact.label}
                    </dt>
                    <dd className="border-t border-stage-rule py-2 font-semibold">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {product.price && (
              <Price price={product.price} t={t} size="large" className="[&_s]:text-stage-text-2" />
            )}
            <div className="flex flex-wrap items-center gap-3">
              {add && quickAdd ? (
                <QuickAdd
                  variantId={add.variantId}
                  path={product.path}
                  action={quickAdd}
                  words={quickAddWords(t, product.title)}
                  wide
                />
              ) : null}
              <a href={product.path} className={add ? "gf-link" : "gf-btn"}>
                {t("home.featured_view")}
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
