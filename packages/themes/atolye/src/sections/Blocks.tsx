import { drawnVariant } from "@qticaret/ui"
import type {
  FormAction,
  HomeSectionView,
  PlaceOrderResult,
  ProductCardView,
  Translate,
} from "@qticaret/ui"
import { Aisles } from "./Aisles"
import { Brands } from "./Brands"
import { Campaign } from "./Campaign"
import { CATEGORY_VARIANTS, CategoryCards } from "./CategoryCards"
import { CategoryCollage } from "./CategoryCollage"
import { CategoryPanels } from "./CategoryPanels"
import { CustomerPhotos } from "./CustomerPhotos"
import { Faq } from "./Faq"
import { GoogleRating } from "./GoogleRating"
import { Guides } from "./Guides"
import { Help } from "./Help"
import { Hero } from "./Hero"
import { HERO_VARIANTS, HeroCatalog } from "./HeroCatalog"
import { HeroSlider } from "./HeroSlider"
import { Look } from "./Look"
import { Marquee } from "./Marquee"
import { type Block, blocksOf, headingId } from "./plan"
import { PriceBands } from "./PriceBands"
import { PROMISE_VARIANTS, Promises } from "./Promises"
import { Reviews } from "./Reviews"
import { ReviewsCarousel } from "./ReviewsCarousel"
import { PhotoCollage } from "./PhotoCollage"
import { Shelf } from "./Shelf"
import { Signup } from "./Signup"
import { Spotlight } from "./Spotlight"
import { Stats } from "./Stats"
import { Steps } from "./Steps"
import { Departures } from "./Departures"
import { Story } from "./Story"
import { StripGallery } from "./StripGallery"

export type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

/** A help section, when the block is one. */
const helpOf = (block: Block | undefined) =>
  block?.kind === "one" && block.section.type === "help" ? block.section : null

/** The block's look: a shelf of joined rails takes its first rail's (adr/0049 Ek 2026-11-14 §6). */
const lookOf = (block: Block) =>
  block.kind === "shelf" ? block.sections[0]?.look : block.section.look

/** The screens it shows on (docs/tema/bilesen-standardi §2): a shelf of joined rails, its first rail's. */
const deviceOf = (block: Block) =>
  block.kind === "shelf" ? block.sections[0]?.device : block.section.device

/** Whether the block is drawn by the one before it (a help section under the FAQ). */
const joined = (block: Block, before: Block | undefined) =>
  helpOf(block) !== null && before?.kind === "one" && before.section.type === "faq"

interface Context {
  t: Translate
  subscribe?: Subscribe | undefined
  quickAdd?: FormAction | undefined
  opening: ProductCardView | null
}

function BlockView({
  block,
  next,
  first,
  afterOpening,
  context,
}: {
  block: Block
  /** The block after it: a help section right after the FAQ joins it there. */
  next: Block | undefined
  first: boolean
  /** Right after the page's picture opening: a trust strip keeps close to it. */
  afterOpening: boolean
  context: Context
}) {
  const { t, subscribe, quickAdd } = context
  if (block.kind === "shelf") {
    return <Shelf sections={block.sections} t={t} quickAdd={quickAdd} />
  }
  const { section } = block
  switch (section.type) {
    case "hero": {
      const product = first ? context.opening : null
      // H17 when the shop chose it and its parts came; else today's opening (`drawnVariant`)
      return drawnVariant("hero", section.variant, HERO_VARIANTS) === "category_list" &&
        section.catalog ? (
        <HeroCatalog
          hero={section}
          catalog={section.catalog}
          product={product}
          first={first}
          t={t}
        />
      ) : (
        <Hero hero={section} product={product} first={first} />
      )
    }
    case "price_bands":
      return <PriceBands section={section} />
    case "hero_slider":
      return <HeroSlider section={section} first={first} t={t} />
    case "trust_badges":
      return (
        <Promises
          badges={section.badges}
          label={t("footer.trust")}
          variant={drawnVariant("trust_badges", section.variant, PROMISE_VARIANTS)}
          marks={section.editor}
          hug={afterOpening}
        />
      )
    case "categories": {
      // The variant's drawing when the theme draws it and the view has it; else today's tiles
      const drawn = drawnVariant("categories", section.variant, CATEGORY_VARIANTS)
      if (drawn === "collage" && section.collage) {
        return (
          <CategoryCollage
            id={headingId(section.id)}
            title={section.title}
            view={section.collage}
            all={section.more ?? { label: t("home.all_categories"), path: "/kategoriler" }}
            ownAll={Boolean(section.more)}
            t={t}
            marks={section.editor}
          />
        )
      }
      if (drawn === "panels" && section.panels) {
        return (
          <CategoryPanels
            id={headingId(section.id)}
            title={section.title}
            view={section.panels}
            all={section.more ?? { label: t("home.all_categories"), path: "/kategoriler" }}
            ownAll={Boolean(section.more)}
            t={t}
            marks={section.editor}
          />
        )
      }
      return drawn === "linked" && section.linked ? (
        <CategoryCards
          id={headingId(section.id)}
          title={section.title}
          view={section.linked}
          all={section.more ?? { label: t("home.all_categories"), path: "/kategoriler" }}
          ownAll={Boolean(section.more)}
          t={t}
          marks={section.editor}
        />
      ) : (
        <Aisles
          id={headingId(section.id)}
          title={section.title}
          categories={section.categories}
          all={section.more ?? { label: t("home.all_categories"), path: "/kategoriler" }}
          ownAll={Boolean(section.more)}
          t={t}
          marks={section.editor}
        />
      )
    }
    case "banner":
      return <Campaign section={section} label={t("home.banner")} first={first} />
    case "strip_gallery":
      return <StripGallery section={section} t={t} first={first} />
    case "featured_product":
      return <Spotlight section={section} t={t} quickAdd={quickAdd} />
    case "reviews":
      // adr/0077 §10: one card each, sliding; the cards carry the customers' photos
      if (section.variant === "carousel") {
        return <ReviewsCarousel section={section} t={t} />
      }
      return (
        <>
          <Reviews section={section} t={t} />
          {section.photos && section.photos.length > 0 && (
            <CustomerPhotos id={`${headingId(section.id)}-foto`} photos={section.photos} t={t} />
          )}
        </>
      )
    case "google_rating":
      return <GoogleRating section={section} t={t} />
    case "rich_text":
      return <Story section={section} />
    case "posts":
      return <Guides section={section} />
    case "faq":
      return <Faq section={section} help={helpOf(next)} t={t} />
    case "help":
      return <Help section={section} t={t} />
    case "newsletter":
      return subscribe ? <Signup section={section} t={t} subscribe={subscribe} /> : null
    case "brands":
      return <Brands section={section} />
    case "stats":
      return <Stats section={section} />
    case "steps":
      return <Steps section={section} />
    case "photo_collage":
      return <PhotoCollage section={section} first={first} />
    case "departures":
      return <Departures section={section} t={t} />
    case "marquee":
      return (
        <Marquee
          section={section}
          t={t}
          boxed={section.look?.width === "boxed" || section.look?.width === "narrow"}
          marks={section.editor}
        />
      )
  }
}

/**
 * The shop's sections as it laid them out (adr/0049), in this theme's
 * shape: product sections side by side joined into one tabbed shelf, a
 * help section right after the FAQ drawn beside its questions. On the
 * home page an opening hero is the page's h1 and its picture the LCP
 * (`heroFirst`, with `opening` the newest pictured product when the hero
 * has none; an opening picture band's picture is the LCP too); on a
 * listing or a product page every section heads with an h2.
 * Each block stands in its look's box, marked with its id (`Look`, adr/0065 §4).
 */
export function Blocks({
  sections,
  t,
  subscribe,
  quickAdd,
  heroFirst = false,
  opening = null,
}: {
  sections: readonly HomeSectionView[]
  t: Translate
  subscribe?: Subscribe | undefined
  quickAdd?: FormAction | undefined
  heroFirst?: boolean
  opening?: ProductCardView | null
}) {
  const blocks = blocksOf(sections)
  const context: Context = { t, subscribe, quickAdd, opening }
  return blocks.map((block, index) =>
    joined(block, blocks[index - 1]) ? null : (
      <Look
        key={block.kind === "shelf" ? (block.sections[0]?.id ?? "raf") : block.section.id}
        id={block.kind === "shelf" ? block.sections[0]?.id : block.section.id}
        look={lookOf(block)}
        device={deviceOf(block)}
      >
        <BlockView
          block={block}
          next={blocks[index + 1]}
          first={heroFirst && index === 0}
          afterOpening={heroFirst && index === 1}
          context={context}
        />
      </Look>
    )
  )
}
