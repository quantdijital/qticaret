import type { ReactElement } from "react"
import type { SectionVariant, VariantSectionType } from "@qticaret/types"
import {
  CategoriesCarousel,
  CategoriesCollage,
  CategoriesIcons,
  CategoriesLinked,
  CategoriesPanels,
  CategoriesTiles,
} from "./category-sketches"
import { FooterBrandColumns, FooterFreeRows, FooterLedger } from "./footer-sketches"
import {
  NewsletterImageCard,
  NewsletterInFooter,
  NewsletterSplit,
  NewsletterStandard,
  NewsletterStrip,
} from "./newsletter-sketches"
import { RichTextArticle, RichTextPane, RichTextWithImage } from "./rich-text-sketches"
import { FaqPage, FaqStandard } from "./faq-sketches"
import { BannerSplit, BannerStandard, PostsGrid, PostsIntroPanel } from "./band-sketches"
import {
  ShelfCarousel,
  ShelfColumns,
  ShelfCompact,
  ShelfFeatured,
  ShelfGrid,
  ShelfRanked,
  ShelfStage,
  ShelfStrips,
} from "./shelf-sketches"

// Each variant drawn in small for the "Biçim" choice (adr/0049 Ek 2026-11-14 §2.6):
// a plain sketch in the current colour, not a picture of the storefront

const Badge = ({ x, y }: { x: number; y: number }) => (
  <>
    <circle cx={x + 4} cy={y + 4} r={3} className="fill-current opacity-60" />
    <rect x={x + 10} y={y + 1.5} width={12} height={2} rx={1} className="fill-current opacity-60" />
    <rect
      x={x + 10}
      y={y + 5}
      width={8}
      height={1.5}
      rx={0.75}
      className="fill-current opacity-35"
    />
  </>
)

const FOUR = [4, 31, 58, 85]

/** Today's strip: four badges on one tinted band. */
function TrustStrip() {
  return (
    <>
      <rect x={1} y={6} width={110} height={20} rx={4} className="fill-current opacity-15" />
      {FOUR.map((x) => (
        <Badge key={x} x={x} y={12} />
      ))}
    </>
  )
}

/** GB4: four boxes in one frame, split by hairlines. */
function TrustLined() {
  return (
    <>
      <rect
        x={1}
        y={6}
        width={110}
        height={20}
        rx={2}
        className="fill-none stroke-current opacity-50"
      />
      {[28.5, 56, 83.5].map((x) => (
        <line key={x} x1={x} y1={6} x2={x} y2={26} className="stroke-current opacity-50" />
      ))}
      {FOUR.map((x) => (
        <Badge key={x} x={x} y={12} />
      ))}
    </>
  )
}

/** adr/0077 §10 Ek: one white box floating over the picture above it, short rules between. */
function TrustCard() {
  return (
    <>
      <rect x={1} y={1} width={110} height={12} rx={2} className="fill-current opacity-25" />
      <rect
        x={6}
        y={8}
        width={100}
        height={20}
        rx={4}
        className="fill-background stroke-current opacity-70"
      />
      {[31, 58, 85].map((x) => (
        <line key={x} x1={x - 2} y1={12} x2={x - 2} y2={24} className="stroke-current opacity-40" />
      ))}
      {[8, 33, 60, 87].map((x) => (
        <Badge key={x} x={x} y={14} />
      ))}
    </>
  )
}

/**
 * Every header drawn in the same frame (one size, one edge, nothing past
 * it), so the three read as three choices of the same thing (owner,
 * 2026-11-15: "Klasik katalog" looked half cut beside the other two).
 */
const HeaderFrame = () => (
  <rect
    data-sketch-frame=""
    x={1}
    y={4}
    width={110}
    height={24}
    rx={3}
    className="fill-current opacity-15"
  />
)

/** A header row: the wordmark at `mark`, the search field and two icons around it. */
const HeaderRow = ({ mark }: { mark: number }) => (
  <>
    <HeaderFrame />
    <rect x={mark} y={13} width={18} height={6} rx={1.5} className="fill-current opacity-70" />
    <rect
      x={mark < 40 ? 30 : 6}
      y={13}
      width={30}
      height={6}
      rx={3}
      className="fill-current opacity-35"
    />
    <circle cx={94} cy={16} r={2.5} className="fill-current opacity-60" />
    <circle cx={103} cy={16} r={2.5} className="fill-current opacity-60" />
  </>
)

/** Today's header: the wordmark first. */
const HeaderStandard = () => <HeaderRow mark={6} />

/** The theme setting's centred header: the wordmark in the middle. */
const HeaderCentered = () => <HeaderRow mark={47} />

/** One row: the wordmark, the menu's words in the middle (the first marked), round tools. */
function HeaderInline() {
  return (
    <>
      <HeaderFrame />
      <rect x={6} y={13} width={16} height={6} rx={1.5} className="fill-current opacity-70" />
      {[34, 48, 62, 76].map((x, index) => (
        <rect
          key={x}
          x={x}
          y={14.5}
          width={10}
          height={3}
          rx={1}
          className={index === 0 ? "fill-current opacity-70" : "fill-current opacity-35"}
        />
      ))}
      <circle cx={96} cy={16} r={3.5} className="fill-none stroke-current opacity-60" />
      <circle cx={105} cy={16} r={3.5} className="fill-none stroke-current opacity-60" />
    </>
  )
}

/** N14 as it is drawn today: a thin strip, the wordmark with a wide search and the phone, a filled menu bar. */
function HeaderCatalog() {
  return (
    <>
      <HeaderFrame />
      <rect x={4} y={6} width={104} height={2.5} rx={1} className="fill-current opacity-25" />
      <rect x={6} y={11.5} width={14} height={5} rx={1.5} className="fill-current opacity-70" />
      <rect
        x={24}
        y={11}
        width={52}
        height={6}
        rx={3}
        className="fill-none stroke-current opacity-50"
      />
      <rect x={84} y={12} width={22} height={4} rx={1.5} className="fill-current opacity-40" />
      <rect x={4} y={20} width={104} height={6} rx={1.5} className="fill-current opacity-70" />
    </>
  )
}

/** Today's opening: one dark stage, the words on its left, the picture on its right. */
function HeroStandard() {
  return (
    <>
      <rect x={1} y={3} width={110} height={26} rx={4} className="fill-current opacity-70" />
      <rect x={60} y={3} width={51} height={26} rx={4} className="fill-current opacity-40" />
      <rect x={8} y={10} width={34} height={4} rx={1} className="fill-background" />
      <rect x={8} y={18} width={18} height={5} rx={2.5} className="fill-background opacity-80" />
    </>
  )
}

/** H17: the category list, the opening as a tile, two category tiles. */
function HeroCategoryList() {
  return (
    <>
      <rect x={1} y={3} width={26} height={26} rx={3} className="fill-current opacity-15" />
      {[7, 13, 19, 25].map((y) => (
        <rect
          key={y}
          x={4}
          y={y - 1}
          width={18}
          height={2}
          rx={1}
          className="fill-current opacity-60"
        />
      ))}
      <rect x={30} y={3} width={56} height={26} rx={3} className="fill-current opacity-25" />
      <rect x={58} y={3} width={28} height={26} rx={3} className="fill-current opacity-50" />
      <rect x={34} y={10} width={18} height={3} rx={1} className="fill-current opacity-80" />
      <rect x={34} y={18} width={12} height={4} rx={2} className="fill-current opacity-60" />
      <rect x={89} y={3} width={22} height={12} rx={3} className="fill-current opacity-50" />
      <rect x={89} y={17} width={22} height={12} rx={3} className="fill-current opacity-50" />
    </>
  )
}

/** The full image (adr/0077 §9): the photograph edge to edge, the words centred over it. */
function HeroFullImage() {
  return (
    <>
      <rect x={1} y={3} width={110} height={26} rx={4} className="fill-current opacity-50" />
      <rect x={36} y={9} width={40} height={4} rx={1} className="fill-background" />
      <rect x={42} y={15} width={28} height={3} rx={1} className="fill-background opacity-70" />
      <rect x={47} y={21} width={18} height={5} rx={2.5} className="fill-background opacity-90" />
    </>
  )
}

// A type with one variant offers no choice and has no sketch
const SKETCHES: {
  readonly [T in VariantSectionType]?: Readonly<Record<SectionVariant<T>, () => ReactElement>>
} = {
  trust_badges: { strip: TrustStrip, lined: TrustLined, card: TrustCard },
  hero: { standard: HeroStandard, category_list: HeroCategoryList, full_image: HeroFullImage },
  categories: {
    tiles: CategoriesTiles,
    linked: CategoriesLinked,
    collage: CategoriesCollage,
    panels: CategoriesPanels,
    icons: CategoriesIcons,
    carousel: CategoriesCarousel,
  },
  header_bar: {
    standard: HeaderStandard,
    centered: HeaderCentered,
    catalog: HeaderCatalog,
    inline: HeaderInline,
  },
  footer_bar: {
    ledger: FooterLedger,
    brand_columns: FooterBrandColumns,
    free_rows: FooterFreeRows,
  },
  newsletter: {
    standard: NewsletterStandard,
    split: NewsletterSplit,
    image_card: NewsletterImageCard,
    strip: NewsletterStrip,
    in_footer: NewsletterInFooter,
  },
  rich_text: { pane: RichTextPane, with_image: RichTextWithImage, article: RichTextArticle },
  faq: { standard: FaqStandard, page: FaqPage },
  posts: { grid: PostsGrid, intro_panel: PostsIntroPanel },
  banner: { standard: BannerStandard, split: BannerSplit },
  products: {
    grid: ShelfGrid,
    carousel: ShelfCarousel,
    featured: ShelfFeatured,
    compact: ShelfCompact,
    columns: ShelfColumns,
    strips: ShelfStrips,
    ranked: ShelfRanked,
    stage_list: ShelfStage,
  },
}

/** A variant in small, in the current colour; a variant without a sketch yet draws nothing. */
export function VariantSketch<T extends VariantSectionType>({
  type,
  variant,
}: {
  type: T
  variant: SectionVariant<T>
}) {
  const sketches: Readonly<Record<string, (() => ReactElement) | undefined>> = SKETCHES[type] ?? {}
  const Sketch = sketches[variant]
  return Sketch ? (
    // `size-full` keeps the toggle's own icon size (`size-4`) off the sketch; `h-8` sets its height
    <svg aria-hidden="true" viewBox="0 0 112 32" className="size-full h-8 max-w-28">
      <Sketch />
    </svg>
  ) : null
}
