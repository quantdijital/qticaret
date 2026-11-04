import type { LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../components/Container"

/**
 * The shop's categories section as a ruled index on a sand band (design.md § Category
 * card without pictures; Loom's ruled rows): an ink rule, then the names
 * in the display face at 32 px in up to three columns, each row one
 * link, and the page of every category as the last row. Under 1024 px the first ones are
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
  className,
}: {
  id: string
  title: string
  categories: readonly LinkView[]
  all: LinkView
  skipOnPhone?: number
  className?: string | undefined
}) {
  return (
    <section aria-labelledby={id} className={cn("bg-paper-2 py-(--section-gap-s)", className)}>
      <Container className="flex flex-col gap-6">
        <h2 id={id}>{title}</h2>
        <ul className="grid grid-cols-1 gap-x-(--gap-columns) border-t-2 border-rule-ink sm:grid-cols-2 xl:grid-cols-3">
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
          {/* Every category, as the index's last row: no name stands alone on it */}
          <li className="border-b border-rule">
            <a href={all.path} className="at-link min-h-11 py-2 lg:min-h-18">
              {all.label}
            </a>
          </li>
        </ul>
      </Container>
    </section>
  )
}
