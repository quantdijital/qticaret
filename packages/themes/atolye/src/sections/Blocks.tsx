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
import { CampaignSplit } from "./CampaignSplit"
import { CATEGORY_VARIANTS, CategoryCards } from "./CategoryCards"
import { CategoryCarousel } from "./CategoryCarousel"
import { CategoryCollage } from "./CategoryCollage"
import { CategoryIcons } from "./CategoryIcons"
import { CategoryPanels } from "./CategoryPanels"
import { CustomerPhotos } from "./CustomerPhotos"
import { Faq } from "./Faq"
import { Guides } from "./Guides"
import { GuidesPanel } from "./GuidesPanel"
import { Help } from "./Help"
import { HeroBlock } from "./HeroBlock"
import { HeroSlider } from "./HeroSlider"
import { Look } from "./Look"
import { Marquee } from "./Marquee"
import { boxLook, panelGround } from "./panel-ground"
import { type Block, blocksOf, headingId } from "./plan"
import { PriceBands } from "./PriceBands"
import { Program } from "./Program"
import { PROMISE_VARIANTS, Promises } from "./Promises"
import { Reviews } from "./Reviews"
import { SearchBoxSection } from "./SearchBoxSection"
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
  block.kind === "shelf" ? block.sections[0]?.look : boxLook(block, block.section.look)

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
  atStart,
  context,
}: {
  block: Block
  /** The block after it: a help section right after the FAQ joins it there. */
  next: Block | undefined
  first: boolean
  /** Right after the page's picture opening: a trust strip keeps close to it. */
  afterOpening: boolean
  /** The page's first block: nothing before it for the trust card to rise over. */
  atStart: boolean
  context: Context
}) {
  const { t, subscribe, quickAdd } = context
  if (block.kind === "shelf") {
    return <Shelf sections={block.sections} t={t} quickAdd={quickAdd} />
  }
  const { section } = block
  switch (section.type) {
    case "hero":
      return (
        <HeroBlock section={section} product={first ? context.opening : null} first={first} t={t} />
      )
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
          lift={section.lift === true && !atStart}
        />
      )
    case "categories": {
      // The variant's drawing when the theme draws it and the view has it; else today's tiles
      const drawn = drawnVariant("categories", section.variant, CATEGORY_VARIANTS)
      // What every drawing takes: the head's id, title, link and the preview's marks
      const head = {
        id: headingId(section.id),
        title: section.title,
        all: section.more ?? { label: t("home.all_categories"), path: "/kategoriler" },
        ownAll: Boolean(section.more),
        t,
        marks: section.editor,
      }
      if (drawn === "collage" && section.collage) {
        return <CategoryCollage {...head} view={section.collage} />
      }
      if (drawn === "icons" && section.icons) {
        return <CategoryIcons {...head} view={section.icons} />
      }
      if (drawn === "panels" && section.panels) {
        return <CategoryPanels {...head} view={section.panels} />
      }
      // The sliding picture cards: the tiles' own cards with the scroller kit
      if (drawn === "carousel" && section.scroller) {
        return (
          <CategoryCarousel {...head} categories={section.categories} scroller={section.scroller} />
        )
      }
      return drawn === "linked" && section.linked ? (
        <CategoryCards {...head} view={section.linked} />
      ) : (
        <Aisles {...head} categories={section.categories} />
      )
    }
    case "banner": {
      // The split (adr/0077 Ek) paints the section's ground on its own panel
      const ground = panelGround(block)
      return ground ? (
        <CampaignSplit section={section} ground={ground} label={t("home.banner")} first={first} />
      ) : (
        <Campaign section={section} label={t("home.banner")} first={first} />
      )
    }
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
    case "rich_text":
      return <Story section={section} />
    case "posts": {
      // The intro panel (adr/0077 Ek) paints the section's ground on its own panel
      const ground = panelGround(block)
      return ground ? (
        <GuidesPanel section={section} ground={ground} />
      ) : (
        <Guides section={section} />
      )
    }
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
    case "search_box":
      return <SearchBoxSection section={section} />
    case "photo_collage":
      return <PhotoCollage section={section} first={first} />
    case "program":
      return <Program section={section} />
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
          atStart={index === 0}
          context={context}
        />
      </Look>
    )
  )
}
