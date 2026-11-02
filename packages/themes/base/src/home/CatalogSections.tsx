import { ArrowUpRight } from "lucide-react"
import type { HomeSectionView, Translate } from "@qticaret/ui"
import { ProductGrid } from "../components/ProductCard"
import { SectionHead, headingId } from "./SectionHead"

type Of<T extends HomeSectionView["type"]> = Extract<HomeSectionView, { type: T }>

const number = (index: number) => String(index + 1).padStart(2, "0")

/** Categories as a numbered index in columns: any number fills it without gaps. */
export function CategoriesSection({ section }: { section: Of<"categories"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="flex scroll-mt-40 flex-col gap-8">
      <SectionHead id={id} title={section.title} />
      <ul className="gap-x-10 rounded-3xl border bg-card px-6 py-3 sm:columns-2 sm:px-8 lg:columns-3 lg:px-10 lg:py-5">
        {section.categories.map((category, index) => (
          <li key={category.path} className="break-inside-avoid border-b last:border-0">
            <a href={category.path} className="group flex items-center gap-4 py-4">
              <span className="tabular w-6 text-xs font-medium text-muted-foreground">
                {number(index)}
              </span>
              <span className="font-heading flex-1 text-xl leading-tight transition-transform duration-300 group-hover:translate-x-1 lg:text-[1.375rem]">
                {category.label}
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A rail of products from the source the shop chose; the first section's first row loads first. */
export function ProductsSection({
  section,
  t,
  eager,
}: {
  section: Of<"products">
  t: Translate
  eager: number
}) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-8">
      <SectionHead id={id} title={section.title} more={section.more} />
      {section.products.length > 0 ? (
        <ProductGrid products={section.products} t={t} eager={eager} />
      ) : (
        <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
          {section.empty}
        </p>
      )}
    </section>
  )
}

/** The shop's brands as a row of names. */
export function BrandsSection({ section }: { section: Of<"brands"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <SectionHead id={id} title={section.title} />
      <ul className="flex flex-wrap gap-2.5">
        {section.brands.map((brand) => (
          <li key={brand.path}>
            <a
              href={brand.path}
              className="inline-flex h-11 items-center rounded-full border bg-card px-5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {brand.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
