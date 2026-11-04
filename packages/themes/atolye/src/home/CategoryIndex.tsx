import type { LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../components/Container"

/**
 * The shop's categories section as a ruled index on a sand band (design.md § Category
 * card without pictures; Loom's ruled rows): an ink rule, then the names
 * in the display face at 32 px in up to four columns, each row one link,
 * and the page of every category. Under 1024 px the first ones are
 * already in the opening, so they are left out here (`skipOnPhone`).
 * TODO(adr/0049 ek, denetim §7): with a category picture in the contract
 * these become the 1:1 photograph cards of the design.
 */
export function CategoryIndex({
  id,
  title,
  categories,
  all,
  skipOnPhone = 0,
}: {
  id: string
  title: string
  categories: readonly LinkView[]
  all: LinkView
  skipOnPhone?: number
}) {
  return (
    <section aria-labelledby={id} className="bg-paper-2 py-(--section-gap-s)">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 id={id}>{title}</h2>
          <a href={all.path} className="at-link shrink-0">
            {all.label}
          </a>
        </div>
        <ul className="grid grid-cols-1 gap-x-(--gap-columns) border-t-2 border-rule-ink sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <li
              key={category.path}
              className={cn("border-b border-rule", index < skipOnPhone && "max-lg:hidden")}
            >
              <a
                href={category.path}
                className="at-row-link flex min-h-11 items-center py-2 text-lg font-medium lg:min-h-18 lg:py-3 lg:font-display lg:text-tile lg:leading-[1.08] lg:font-normal lg:tracking-(--tracking-display)"
              >
                {category.label}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
