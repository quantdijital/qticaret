import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../components/Container"
import { OPENING_CATEGORIES, type Opening as OpeningPlan } from "./plan"

/** A heading's id from the section's own: unique on the page, stable across requests. */
export const headingId = (sectionId: string) => `bolum-${sectionId}`

const photoOf = (opening: OpeningPlan): { image: ImageView; link: LinkView } | null => {
  const [action] = opening.hero.actions
  // The shop's own opening picture first, else its newest pictured product
  if (opening.hero.image && action) {
    return { image: opening.hero.image, link: action }
  }
  const product = opening.photo
  return product?.image
    ? { image: product.image, link: { label: product.title, path: product.path } }
    : null
}

/**
 * The opening (design.md: hero; review 2026-11-05). The shop's heading,
 * its line and at most two actions beside one of the shop's own product
 * photographs, square, half the container: the catalogue's blade on
 * its bark or leather is the strongest thing the shop has. Under 1024 px,
 * where the category bar sits in the drawer, the first categories follow
 * the actions as ruled rows (the brief: categories on a phone's first
 * screen), the photograph after them. The photograph is a picture only, a
 * link named by its product; its name and price are on its card below.
 * The hero's short line above the heading is not drawn: no eyebrow here.
 */
export function Opening({ opening, first }: { opening: OpeningPlan; first: boolean }) {
  const { hero, categories } = opening
  const [main, second] = hero.actions
  const id = headingId(hero.id)
  const photo = photoOf(opening)
  const quick = (categories?.categories ?? []).slice(0, OPENING_CATEGORIES)
  const headingClass = "max-w-[20ch] font-display text-display leading-[1.04]"
  return (
    <section aria-labelledby={id} className="pt-6 pb-10 lg:pt-10">
      <Container
        className={cn(
          "grid gap-6 lg:items-center lg:gap-x-(--gap-columns)",
          photo && "lg:grid-cols-12"
        )}
      >
        <div className="flex flex-col gap-4 lg:col-span-6 lg:gap-6">
          {/* The page's one h1 is the first opening; a later one is a section */}
          {first ? (
            <h1 id={id} className={headingClass}>
              {hero.heading}
            </h1>
          ) : (
            <h2 id={id} className={headingClass}>
              {hero.heading}
            </h2>
          )}
          {hero.intro && <p className="lead max-w-[46ch] text-text-2">{hero.intro}</p>}
          {main && (
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={main.path} className="at-btn">
                {main.label}
              </a>
              {second && (
                <a href={second.path} className="at-btn at-btn--quiet">
                  {second.label}
                </a>
              )}
            </div>
          )}
          {categories && quick.length > 0 && (
            <nav aria-label={categories.title} className="pt-2 lg:hidden">
              <ul className="grid grid-cols-2 gap-x-4 border-t-2 border-rule-ink md:grid-cols-3">
                {quick.map((category) => (
                  <li key={category.path} className="border-b border-rule">
                    <a
                      href={category.path}
                      className="at-row-link flex min-h-11 items-center py-2 font-medium"
                    >
                      {category.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        {photo && (
          <a
            href={photo.link.path}
            aria-label={photo.link.label}
            className="at-tile relative block aspect-square overflow-hidden bg-paper-2 lg:col-span-6"
          >
            <ResponsiveImage
              image={photo.image}
              sizes="(min-width: 1440px) 640px, (min-width: 1024px) 45vw, 100vw"
              priority
              className="absolute inset-0 h-full w-full object-cover"
            />
          </a>
        )}
      </Container>
    </section>
  )
}
