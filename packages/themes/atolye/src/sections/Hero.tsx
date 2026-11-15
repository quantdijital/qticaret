import { ResponsiveImage, fieldMark } from "@qticaret/ui"
import type { ProductCardView } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Preload } from "../parts/Preload"
import { type Of, headingId } from "./plan"

const SIZES = "(min-width: 1024px) 56vw, 100vw"

/**
 * The opening (docs/tema/yon-2026-11-05.md § Hero): one graphite stage,
 * the shop's heading, its line and its first action beside the shop's
 * own photograph, which merges into the graphite at its inner edge. A
 * phone: the photograph over the heading and the action (the line waits
 * for 640 px), the stage under half the screen; from 1024 px 58% of the
 * screen (28–36rem), so a 768 px laptop still sees the promises whole
 * under it. The picture is the
 * hero's own, else the shop's newest pictured product (its card with
 * the name and price follows on the shelf). No slider; nothing moves.
 */
export function Hero({
  hero,
  product,
  first,
}: {
  hero: Of<"hero">
  product: ProductCardView | null
  /** The page's first section: its heading is the h1 and its picture the LCP. */
  first: boolean
}) {
  const id = headingId(hero.id)
  const [action] = hero.actions
  const image = hero.image ?? product?.image ?? null
  const Heading = first ? "h1" : "h2"
  // The editor's field marks (adr/0065 Faz 2b): in its live preview only
  const on = hero.editor
  return (
    <section aria-labelledby={id} className="pt-3 lg:pt-6">
      {first && image && <Preload image={image} sizes={SIZES} />}
      <Container>
        <div className="gf-stage relative grid overflow-hidden rounded-tile lg:min-h-[clamp(28rem,58svh,36rem)] lg:grid-cols-12">
          {image && (
            <div
              {...fieldMark(on, "image")}
              className="relative aspect-[16/10] after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:from-0% after:via-stage/0 after:via-30% after:to-transparent sm:aspect-[2/1] lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:aspect-auto lg:after:bg-linear-to-r lg:after:via-25%"
            >
              <ResponsiveImage
                image={image}
                sizes={SIZES}
                priority={first}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex flex-col justify-center gap-4 p-5 pt-3 sm:p-8 sm:pt-4 lg:col-span-5 lg:row-start-1 lg:gap-6 lg:p-14">
            <Heading
              id={id}
              {...fieldMark(on, "heading")}
              className="max-w-[18ch] text-hero leading-[1.05] tracking-(--tracking-display) text-stage-text"
            >
              {hero.heading}
            </Heading>
            {hero.intro && (
              <p
                {...fieldMark(on, "text")}
                className="hidden max-w-[44ch] text-md text-stage-text-2 sm:block lg:text-lead"
              >
                {hero.intro}
              </p>
            )}
            {action && (
              <div className="pt-1">
                <a href={action.path} className="gf-btn" {...fieldMark(on, "links.0")}>
                  {action.label}
                </a>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  )
}
