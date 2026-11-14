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
import { CustomerPhotos } from "./CustomerPhotos"
import { Faq } from "./Faq"
import { GoogleRating } from "./GoogleRating"
import { Guides } from "./Guides"
import { Help } from "./Help"
import { Hero } from "./Hero"
import { HeroSlider } from "./HeroSlider"
import { Look } from "./Look"
import { Marquee } from "./Marquee"
import { type Block, blocksOf, headingId } from "./plan"
import { PROMISE_VARIANTS, Promises } from "./Promises"
import { Reviews } from "./Reviews"
import { Shelf } from "./Shelf"
import { Signup } from "./Signup"
import { Spotlight } from "./Spotlight"
import { Story } from "./Story"

export type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

/** A help section, when the block is one. */
const helpOf = (block: Block | undefined) =>
  block?.kind === "one" && block.section.type === "help" ? block.section : null

/** The block's look: a shelf of joined rails takes its first rail's (adr/0049 Ek 2026-11-14 §6). */
const lookOf = (block: Block) =>
  block.kind === "shelf" ? block.sections[0]?.look : block.section.look

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
  context,
}: {
  block: Block
  /** The block after it: a help section right after the FAQ joins it there. */
  next: Block | undefined
  first: boolean
  context: Context
}) {
  const { t, subscribe, quickAdd } = context
  if (block.kind === "shelf") {
    return <Shelf sections={block.sections} t={t} quickAdd={quickAdd} />
  }
  const { section } = block
  switch (section.type) {
    case "hero":
      return <Hero hero={section} product={first ? context.opening : null} first={first} />
    case "hero_slider":
      return <HeroSlider section={section} first={first} t={t} />
    case "trust_badges":
      return (
        <Promises
          badges={section.badges}
          label={t("footer.trust")}
          variant={drawnVariant("trust_badges", section.variant, PROMISE_VARIANTS)}
        />
      )
    case "categories":
      return (
        <Aisles
          id={headingId(section.id)}
          title={section.title}
          categories={section.categories}
          all={{ label: t("home.all_categories"), path: "/kategoriler" }}
        />
      )
    case "banner":
      return <Campaign section={section} label={t("home.banner")} />
    case "featured_product":
      return <Spotlight section={section} t={t} quickAdd={quickAdd} />
    case "reviews":
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
    case "marquee":
      return (
        <Marquee
          section={section}
          t={t}
          boxed={section.look?.width === "boxed" || section.look?.width === "narrow"}
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
 * has none); on a listing or a product page every section heads with an h2.
 * Each block stands in its look's box when the shop set one (`Look`).
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
        look={lookOf(block)}
      >
        <BlockView
          block={block}
          next={blocks[index + 1]}
          first={heroFirst && index === 0}
          context={context}
        />
      </Look>
    )
  )
}
