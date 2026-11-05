import { ResponsiveImage } from "@qticaret/ui"
import type { FeaturedProductSectionView, FormAction, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../components/Container"
import { quickAddWords } from "../components/ProductCard"
import { QuickAdd } from "../components/QuickAdd"
import { Facts, Figure, Sheet, nameParts } from "./CloseUpParts"
import { headingId } from "./Opening"

/** How many of the shop's headline facts stand under the price; any more stay in the rows. */
const FACTS = 4
/** Up to this many rows the rest of the sheet runs on in the words' column; more go under the photograph. */
const ROWS_IN_COLUMN = 8

/**
 * One product up close (design.md § Picks, the signature; adr/0046 Ek
 * 2026-11-05), on a sand band (Loom: the price as a figure on a sand well
 * where the order is placed): the shop's own photograph of it large and
 * square on seven columns (4:3 across a tablet, where it stands over its
 * words), a photograph the page does not show yet (not the opening's,
 * not a shelf card's) when the product has one; beside it its name (the
 * catalogue's description under it), the shop's line, the price as the
 * figure, its headline facts and one action (the shelf's quick add as
 * the filled button when the card has one, else the link to its page),
 * then the rest of its spec table as ruled rows in the template's
 * sections: in that column while it is short, under the photograph when
 * it is long. A headline fact is not said twice; the product's page has
 * the whole table. With a heading of the shop's, that is the h2 and the
 * name sits under it; without one, the name is the h2 (no label above).
 */
export function CloseUp({
  section,
  t,
  quickAdd,
  shownPhotos,
}: {
  section: FeaturedProductSectionView
  t: Translate
  /** The storefront's add-to-cart (adr/0046 Ek 2026-11-04); none: the link only. */
  quickAdd?: FormAction | undefined
  /** The photographs the page already shows (the opening's, the shelf cards'). */
  shownPhotos?: ReadonlySet<string> | undefined
}) {
  const id = headingId(section.id)
  const { product } = section
  const image =
    section.images.find((picture) => !shownPhotos?.has(picture.src)) ??
    section.images[0] ??
    product.image
  const out = !product.available || product.stock === "out"
  const quick = quickAdd && !out ? (product.quickAdd ?? null) : null
  const facts = section.facts.slice(0, FACTS)
  // Each fact said once (Hallmark 69): the headline ones under the price, the rest in the rows
  const said = new Set(facts.map((fact) => `${fact.label}\n${fact.value}`))
  const groups = section.specGroups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => !said.has(`${row.label}\n${row.value}`)),
    }))
    .filter((group) => group.rows.length > 0)
  const stacked = groups.reduce((sum, group) => sum + group.rows.length, 0) <= ROWS_IN_COLUMN
  const shopHeading = section.title?.trim() ? section.title : null
  const Name = shopHeading ? "h3" : "h2"
  const { name, rest } = nameParts(product.title)
  const stock = out ? (
    <p className="text-sm font-medium">{t("product.out_of_stock")}</p>
  ) : product.stock === "low" ? (
    <p className="text-sm font-medium text-warn">{t("product.few_left")}</p>
  ) : null
  const sheet =
    groups.length > 0 ? (
      <Sheet groups={groups} level={shopHeading ? "h4" : "h3"} stacked={stacked} t={t} />
    ) : null
  return (
    <section aria-labelledby={id} className="mt-(--section-gap) bg-paper-2 py-(--section-gap-s)">
      <Container className="flex flex-col gap-12 lg:gap-16">
        <div
          className={cn(
            "grid gap-8 lg:grid-cols-12 lg:gap-x-(--gap-columns)",
            stacked && sheet ? "lg:items-start" : "lg:items-center"
          )}
        >
          {image && (
            // The action below is the link a reader meets; the picture is one more for the pointer
            <a
              href={product.path}
              tabIndex={-1}
              aria-hidden="true"
              className="relative block aspect-square overflow-hidden bg-paper-3 md:aspect-[4/3] lg:col-span-6 lg:aspect-square xl:col-span-7"
            >
              <ResponsiveImage
                image={image}
                sizes="(min-width: 1440px) 752px, (min-width: 1280px) 52vw, (min-width: 1024px) 45vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </a>
          )}
          <div
            className={cn(
              "flex min-w-0 flex-col gap-6",
              image ? "lg:col-span-6 xl:col-span-5" : "lg:col-span-8"
            )}
          >
            <div className="flex flex-col gap-3">
              {shopHeading && <h2 id={id}>{shopHeading}</h2>}
              <Name id={shopHeading ? undefined : id}>{name}</Name>
              {rest && <p className="text-lg text-text-2">{rest}</p>}
              {section.subtitle && <p className="text-md text-text-3">{section.subtitle}</p>}
            </div>
            {section.text && <p className="lead text-text-2">{section.text}</p>}
            {product.price ? (
              <Figure price={product.price} t={t}>
                {stock}
              </Figure>
            ) : (
              stock
            )}
            {facts.length > 0 && <Facts facts={facts} />}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              {quick && quickAdd ? (
                <>
                  <div className="w-full sm:w-auto">
                    <QuickAdd
                      primary
                      variantId={quick.variantId}
                      path={product.path}
                      action={quickAdd}
                      words={quickAddWords(t, product.title, t("product.quick_add"))}
                    />
                  </div>
                  <a href={product.path} className="at-link">
                    {t("home.featured_view")}
                  </a>
                </>
              ) : (
                <a href={product.path} className="at-btn">
                  {t("home.featured_view")}
                </a>
              )}
            </div>
            {stacked && sheet}
          </div>
        </div>
        {!stacked && sheet}
      </Container>
    </section>
  )
}
