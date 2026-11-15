import type {
  HeroCatalogSlideView,
  HeroCatalogView,
  ImageView,
  ProductCardView,
  Translate,
} from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Preload } from "../parts/Preload"
import { type Of, headingId } from "./plan"
import { CatalogChips, CatalogList, CatalogTiles } from "./HeroCatalogParts"
import { CatalogSlide, PHOTO_SIZES, WHOLE_SIZES, pictureOnly } from "./HeroCatalogSlide"
import type { SlideExtras, SlidePlace } from "./HeroCatalogSlide"
import { SliderStage, type SliderWords } from "./SliderStage"

/** The opening's variants this theme draws (`drawnVariant`): today's and the category list. */
export const HERO_VARIANTS = ["standard", "category_list"] as const

/**
 * Two or more slides in the opening's tile (adr/0049 Ek 2026-11-15): the
 * sliding opening's stage (`SliderStage`: swipe, keys, arrows, dots, a
 * pause button while it turns by itself, still for reduced motion, held
 * on hover and focus) as tall as the list beside it, every slide as tall
 * as the tallest (no shift between them).
 */
function Slides({
  slides,
  slider,
  imageOf,
  place,
  extras,
  t,
}: {
  slides: HeroCatalogSlideView[]
  slider: NonNullable<HeroCatalogView["slider"]>
  imageOf: (slide: HeroCatalogSlideView, index: number) => ImageView | null
  place: Omit<SlidePlace, "stage">
  extras: SlideExtras
  t: Translate
}) {
  const total = slides.length
  const words: SliderWords = {
    label: t("home.slider"),
    previous: t("home.slider_previous"),
    next: t("home.slider_next"),
    play: t("home.slider_play"),
    pause: t("home.slider_pause"),
    slides: slides.map((_, index) => t("home.slider_slide", { n: index + 1, total })),
    goTo: slides.map((_, index) => t("home.slider_go", { n: index + 1 })),
  }
  const { settings } = slider
  const arrows = settings.arrows !== "hidden"
  return (
    <div
      className="gf-mosaic-stage"
      role="group"
      aria-roledescription="carousel"
      aria-label={words.label}
    >
      <SliderStage
        words={words}
        autoplay={settings.autoplay === "on"}
        interval={slider.interval}
        dots={settings.dots === "on"}
        arrows={settings.arrows}
        arrowStyle={settings.arrow_style}
        loop={settings.loop === "on"}
        focusable={slides.some((slide) => slide.actions.length === 0 && !slide.link)}
        fill
      >
        {slides.map((slide, index) => (
          <CatalogSlide
            key={String(index)}
            slide={slide}
            image={imageOf(slide, index)}
            place={
              index === 0
                ? { ...place, stage: { arrows } }
                : { level: "h2", name: place.name, eager: false, stage: { arrows } }
            }
            extras={index === 0 ? extras : null}
          />
        ))}
      </SliderStage>
    </div>
  )
}

/**
 * The catalogue opening, H17 (adr/0049 Ek 2026-11-14 §3.2; design.md §
 * Katalog açılışı): the shop's category list with each one's picture and
 * product count, the opening as the middle tile (heading, line, the
 * lowest price of the products shown small, the buttons, the products
 * small with the shop's labels, the picture), two category tiles, and the
 * quick links under them. The heading is the page's h1 when the opening
 * comes first and its picture the LCP; the picture is the opening's own,
 * else the shop's newest pictured product. One slide (every opening saved
 * before slides) has no script and nothing moves; two or more turn in the
 * tile (adr/0049 Ek 2026-11-15), the list and tiles staying put.
 */
export function HeroCatalog({
  hero,
  catalog,
  product,
  first,
  t,
}: {
  hero: Of<"hero">
  catalog: HeroCatalogView
  product: ProductCardView | null
  first: boolean
  t: Translate
}) {
  const id = headingId(hero.id)
  // An opening saved before slides is one slide: its own words, buttons and picture
  const slides: HeroCatalogSlideView[] = catalog.slides ?? [
    {
      heading: hero.heading,
      intro: hero.intro,
      actions: hero.actions,
      image: hero.image,
      link: null,
    },
  ]
  // The shop's own picture keeps the words it wrote; a stand-in product photo says nothing
  const standIn = product?.image ? { ...product.image, alt: "" } : null
  const imageOf = (slide: HeroCatalogSlideView, index: number) =>
    slide.image ?? (index === 0 ? standIn : null)
  const opening = slides[0]
  const lead = opening ? imageOf(opening, 0) : null
  const place: Omit<SlidePlace, "stage"> = {
    level: first ? "h1" : "h2",
    id,
    name: hero.heading,
    eager: first,
  }
  const extras: SlideExtras = { eyebrow: hero.eyebrow, catalog, t }
  return (
    <section aria-labelledby={id} data-gf-catalog-hero="" className="pt-3 lg:pt-6">
      {first && opening && lead && (
        <Preload image={lead} sizes={pictureOnly(opening) ? WHOLE_SIZES : PHOTO_SIZES} />
      )}
      <Container>
        <div className="gf-mosaic">
          {slides.length > 1 && catalog.slider ? (
            <Slides
              slides={slides}
              slider={catalog.slider}
              imageOf={imageOf}
              place={place}
              extras={extras}
              t={t}
            />
          ) : opening ? (
            <CatalogSlide
              slide={opening}
              image={lead}
              place={{ ...place, stage: null }}
              extras={extras}
            />
          ) : null}
          {catalog.list.length > 0 && <CatalogList catalog={catalog} t={t} />}
          {catalog.tiles.length > 0 && <CatalogTiles catalog={catalog} t={t} />}
        </div>
        {catalog.chips.length > 0 && <CatalogChips catalog={catalog} t={t} />}
      </Container>
    </section>
  )
}
