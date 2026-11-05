import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView, ProductCardView } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"

const SIZES = "(min-width: 1024px) 56vw, 100vw"

/** The LCP picture asked for first, before the parser reaches it (React puts the link in <head>). */
function Preload({ image }: { image: ImageView }) {
  const set = image.sources.avif ?? image.sources.webp
  return set ? (
    <link
      rel="preload"
      as="image"
      href={image.src}
      imageSrcSet={set}
      imageSizes={SIZES}
      type={image.sources.avif ? "image/avif" : "image/webp"}
      fetchPriority="high"
    />
  ) : (
    <link rel="preload" as="image" href={image.src} fetchPriority="high" />
  )
}

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
  return (
    <section aria-labelledby={id} className="pt-3 lg:pt-6">
      {first && image && <Preload image={image} />}
      <Container>
        <div className="gf-stage relative grid overflow-hidden rounded-tile lg:min-h-[clamp(28rem,58svh,36rem)] lg:grid-cols-12">
          {image && (
            <div className="relative aspect-[16/10] after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:from-0% after:via-stage/0 after:via-30% after:to-transparent sm:aspect-[2/1] lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:aspect-auto lg:after:bg-linear-to-r lg:after:via-25%">
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
              className="max-w-[18ch] text-hero leading-[1.05] tracking-(--tracking-display) text-stage-text"
            >
              {hero.heading}
            </Heading>
            {hero.intro && (
              <p className="hidden max-w-[44ch] text-md text-stage-text-2 sm:block lg:text-lead">
                {hero.intro}
              </p>
            )}
            {action && (
              <div className="pt-1">
                <a href={action.path} className="gf-btn">
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
