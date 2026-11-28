import type {
  CategoriesVariant,
  FaqSettings,
  HeroVariant,
  StoreFaqItem,
  RichTextImageSide,
  RichTextVariant,
  ReviewsProductImage,
  ReviewsVariant,
  ScrollerSettings,
  SectionDevice,
  SectionLook,
  TrustBadgesVariant,
} from "@qticaret/types"
import type { BannerSectionView } from "./banner-views"
import type { PostsSectionView } from "./posts-views"
import type { CategoryCardView, CustomerPhotoView, ShopMarkView } from "./card-views"
import type {
  CategoryCardsView,
  CategoryCollageView,
  CategoryPanelsView,
} from "./category-card-views"
import type { HeroCatalogView, PriceBandsSectionView } from "./catalog-views"
import type { HeroFullView } from "./hero-full-views"
import type { HeadLinesView } from "./hand-note-views"
import type { ListingTextView } from "./listing-views"
import type {
  FeaturedProductSectionView,
  HeroSliderSectionView,
  ShopRatingView,
} from "./home-views"
import type { PaginationView } from "./listing-views"
import type { MarqueeSectionView } from "./marquee-views"
import type { NewsletterLookView } from "./newsletter-views"
import type { ContentPageSectionView } from "./page-text-views"
import type { BreadcrumbView, ProductCardView, ReviewView } from "./product-views"
import type { ProductsSectionView } from "./shelf-views"
import type { StatsSectionView, StepsSectionView } from "./points-views"
import type { SearchBoxSectionView } from "./search-form-views"
import type { CategoryIconsView } from "./icon-views"
import type { PhotoCollageSectionView } from "./collage-views"
import type { ProgramSectionView } from "./program-views"
import type { DeparturesSectionView } from "./departures-views"
import type { StripGallerySectionView } from "./strip-views"
import type { ContactView, ImageView, LinkView, SocialLinkView, TrustBadgeView } from "./views"

/**
 * The home page, the blog and content pages as a theme shows them
 * (adr/0046 §7, adr/0049): their sections, posts, contact form and the
 * shop-wide reviews page.
 */

/**
 * A section's look as a theme reads it (adr/0049 Ek 2026-11-14 §6): only
 * the steps the shop set and the contract knows; a field left out is the
 * theme's own drawing. A theme maps each step onto its own scale and may
 * leave a field unread where it means nothing in that section.
 */
export type SectionLookView = Partial<SectionLook>

/**
 * Which screens show a section (docs/tema/bilesen-standardi §2): only on
 * phones (the theme's narrow frame) or only on wide screens; none (absent)
 * everywhere. A theme hides it with CSS at its own breakpoint, so the page
 * is the same for every visitor (cached, no layout shift) and a lazy picture
 * in the hidden section is not fetched.
 */
export type SectionDeviceView = Exclude<SectionDevice, "all">

/**
 * A brand in the brands section: its page, and its logo when the shop
 * gave it one (its `alt` the brand's name, as the logo stands for the
 * name); none (or absent): the theme draws the name.
 */
export interface SectionBrandView extends LinkView {
  logo?: ImageView | null
}

/**
 * A section as the theme draws it (adr/0049): the shop lays the home,
 * product and category pages out in the theme editor; every title already
 * in words (the shop's own or the storefront's default, a FAQ's aside),
 * every link already a path; its look beside (none: the theme's own) and
 * the screens it shows on (none: everywhere). `editor` is set only in the
 * theme editor's live preview: the theme then marks its fields
 * (`fieldMark`, adr/0065 Faz 2b); never on a live page.
 */
export type HomeSectionView = {
  look?: SectionLookView
  device?: SectionDeviceView
  editor?: true
} & (
  | {
      id: string
      type: "hero"
      /** A short line above the heading; null: none. */
      eyebrow: string | null
      /** The shop's heading, else its name. */
      heading: string
      intro: string | null
      /** At most two buttons, the first the main one. */
      actions: LinkView[]
      /** Each button's place among the design's links when a broken one was left out (the editor's field mark); absent: its drawn place. */
      actionsAt?: number[]
      image: ImageView | null
      /** How the opening is drawn (adr/0049 Ek 2026-11-14 §2); none: today's (`standard`). */
      variant?: HeroVariant
      /** `category_list`'s own parts (H17); a theme without that drawing leaves them unread. */
      catalog?: HeroCatalogView | null
      /** `full_image`'s own parts (adr/0077 §9); a theme without that drawing leaves them unread. */
      full?: HeroFullView | null
    }
  | PriceBandsSectionView
  | HeroSliderSectionView
  | MarqueeSectionView
  | BannerSectionView
  | StripGallerySectionView
  | StatsSectionView
  | StepsSectionView
  | SearchBoxSectionView
  | PhotoCollageSectionView
  | DeparturesSectionView
  | (HeadLinesView & {
      id: string
      type: "categories"
      title: string
      /** Each card's `count` is set when the shop shows counts. */
      categories: CategoryCardView[]
      /** The link beside the title; none (or absent): the theme's "every category". */
      more?: LinkView | null
      /** How the cards are drawn (adr/0049 Ek 2026-11-15); none: today's tiles. */
      variant?: CategoriesVariant
      /**
       * `linked`'s settings and cards (the same cards as `categories`, with
       * their subcategories); a theme without that drawing draws the tiles.
       */
      linked?: CategoryCardsView | null
      /** `collage`'s settings and cards; a theme without that drawing draws the tiles. */
      collage?: CategoryCollageView | null
      /** `panels`' settings and cards; a theme without that drawing draws the tiles. */
      panels?: CategoryPanelsView | null
      /** `icons`' settings and discs (adr/0077 §10 Ek); a theme without that drawing draws the tiles. */
      icons?: CategoryIconsView | null
      /** `carousel`'s scroller settings: `categories` in one sliding row; a theme without it draws the tiles. */
      scroller?: ScrollerSettings | null
    })
  | ProductsSectionView
  | FeaturedProductSectionView
  | { id: string; type: "brands"; title: string; brands: SectionBrandView[] }
  | PostsSectionView
  | (HeadLinesView & {
      id: string
      type: "reviews"
      title: string
      /** Each review's product; its picture only when `product_image` asks for one. */
      reviews: (ReviewView & { product: ReviewedProductView | null })[]
      more: LinkView
      /** The newest customer photos on approved reviews (adr/0046 Ek 2026-11-04); none: no strip. */
      photos?: CustomerPhotoView[]
      /** The shop's average, count and stars' spread (adr/0046 Ek 2026-11-05); none: not drawn. */
      summary?: ShopRatingView | null
      /**
       * `carousel` (adr/0077 §10): every review one card in a sliding row,
       * with `scroller`; absent: today's grid.
       */
      variant?: ReviewsVariant
      scroller?: ScrollerSettings
      /** `carousel` only (adr/0077 §10 Ek): the product's picture on each card; absent: none. */
      product_image?: ReviewsProductImage
    })
  | {
      id: string
      type: "rich_text"
      title: string | null
      html: string
      /**
       * `with_image` (adr/0073 §3, "Görselli metin"): the picture beside the
       * text and its side from 1024 px; absent (or without a picture): the pane.
       * A content page's own text (`article`) is a `PageArticleView`.
       */
      variant?: Exclude<RichTextVariant, "article">
      image?: ImageView | null
      imageSide?: RichTextImageSide
    }
  | {
      id: string
      type: "trust_badges"
      /** How the strip is drawn (adr/0049 Ek 2026-11-14 §2); a theme draws its default for one it lacks (`drawnVariant`). */
      variant: TrustBadgesVariant
      badges: TrustBadgeView[]
      /** The card's lift over the section before it (adr/0077 §10 Ek); absent: none. */
      lift?: boolean
    }
  | ({
      id: string
      type: "newsletter"
      title: string
      text: string
      privacyPath: string | null
    } & Partial<NewsletterLookView>)
  | { id: string; type: "help"; title: string; text: string; contact: ContactView }
  | {
      id: string
      type: "faq"
      /** None: the theme's own words ("Sık sorulan sorular"). */
      title: string | null
      /**
       * The rows in order (adr/0073 Ek 2026-11-24 (2)): a question with its
       * answer as the backend's HTML (`html`), or a plain answer saved
       * before rich answers (`answer`); or a group's heading. The theme
       * keeps the answers in the HTML (open or closed).
       */
      items: StoreFaqItem[]
      /**
       * The first question open, one open at a time (bilesen-denetimi (b) 8).
       * Absent (an older storefront): all closed, each opened on its own.
       */
      settings?: FaqSettings
    }
  | ProgramSectionView
)

export interface HomePageView {
  sections: HomeSectionView[]
  /** A line above the page: a draft's preview says it is one. */
  notice?: string | null
}

export interface PostCardView {
  title: string
  path: string
  excerpt: string
  image: ImageView | null
  /** "1 Kasım 2026", already in words; null for an undated post. */
  date: string | null
  /** The machine form for `<time datetime>`. */
  dateTime: string | null
  /** "5 dk okuma", already in words. */
  reading: string
  /** The post's category, at its archive (adr/0019 ek 2026-11-03); null when it has none. */
  category?: LinkView | null
}

/** A link in the blog's bar of categories: "all posts" first, then each category. */
export interface BlogTermLinkView extends LinkView {
  /** The page this is (the index, or this category's archive). */
  current: boolean
}

export interface BlogIndexPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  posts: PostCardView[]
  pagination: PaginationView
  /** The blog's categories with live posts; none: no bar. */
  terms?: BlogTermLinkView[]
  /**
   * On a category's or tag's archive: which; null on the index. Its own
   * words come as `footText` (adr/0075 Ek 2026-11-24); `description` is
   * what an older storefront sends for under the title (now always empty).
   */
  activeTerm?: { kind: "category" | "tag"; name: string; description: string[] } | null
  /**
   * The archive's own text at its foot, after the posts and their pages, on
   * its first page only, drawn as a product listing's (adr/0075 Ek
   * 2026-11-24); none or absent: nothing there.
   */
  footText?: ListingTextView | null
  /** On an author's page (`/blog/yazar/{handle}`, adr/0060): who, for the page's head; null elsewhere. */
  activeAuthor?: AuthorView | null
}

/** A blog post's author (adr/0060): the post's closing box and the author's page head. */
export interface AuthorView {
  name: string
  /** The author's page (`/blog/yazar/{handle}`). */
  path: string
  /** "Bıçak ustası"; null: none given. */
  jobTitle: string | null
  /** The bio as plain paragraphs; none: no bio. */
  bio: string[]
  /** The author's photo; null: none (the theme may show the initial). */
  image: ImageView | null
  /** The author's own profiles, each labelled ("Web sitesi", "LinkedIn"…), in a fixed order. */
  links: SocialLinkView[]
}

export interface ContentPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  /**
   * The backend's own HTML from its allow-listed schema (adr/0019): safe to
   * print as it is. A post's text; on a page its text whole, which a theme
   * draws only when the page came without `sections`.
   */
  html: string
  publishedAt: string | null
  /** A line above the page, in words: a draft's preview says it is one. */
  notice?: string | null
  /** A post's category and tags, at their archives (adr/0019 ek 2026-11-03). */
  category?: LinkView | null
  tags?: LinkView[]
  /*
   * What the content pages' own design asks for (adr/0046 Ek 2026-11-05,
   * içerik sayfaları). Every one optional: a theme that does not read them
   * draws the page as before.
   */
  /** The page's or post's cover picture; none: no picture. */
  image?: ImageView | null
  /** A post's `h2`s in order, `html` carrying their ids, for a table of contents. */
  outline?: OutlineItemView[]
  /** A blog post's date, reading time and author; null on a page. */
  post?: PostMetaView | null
  /** The post's author for a box at the end of the article (adr/0060); null: none chosen. */
  author?: AuthorView | null
  /** Posts to read next: the same category's first, then the newest; never this one. */
  related?: PostCardView[]
  /** The products the text's product cards name (adr/0019 kısa kodlar), as the shop's cards. */
  products?: ProductCardView[]
  /** The page's address on the networks a reader shares with, each its own share link. */
  share?: SocialLinkView[]
  /**
   * A content page's sections (adr/0073 Ek 2026-11-19 (2) K8), from the
   * theme editor, as one list in the shop's order: the page's own text
   * among them (`PageTextSectionView`: its text, the contact page's body,
   * the payment and shipping facts), the home page's types around it. The
   * page's head (trail, its one h1, its cover) is not a section and stands
   * above them. Absent (a storefront before it): `html` is the page's text,
   * drawn alone. Never on a post.
   */
  sections?: ContentPageSectionView[]
}

/** A blog post's facts beside its title: when, how long a read, who wrote it. */
export interface PostMetaView {
  /** "1 Kasım 2026", already in words; null for an undated post. */
  date: string | null
  /** The machine form for `<time datetime>`. */
  dateTime: string | null
  /** "5 dk okuma", already in words. */
  reading: string
  author: string | null
  /** The author's page, for the byline's link (adr/0060); null: the name alone (no author chosen). */
  authorPath?: string | null
}

/** A questions page as groups: the text before the first question (HTML), then each group. */
export interface FaqView {
  intro: string
  groups: FaqGroupView[]
}

/** A group of a questions page: its heading (none before the first) and its questions. */
export interface FaqGroupView {
  /** An anchor for the group's heading. */
  id: string
  title: string | null
  /** The text under the heading before its first question (HTML); "" for none. */
  lead: string
  /** Each answer the backend's own HTML (adr/0019). */
  items: { question: string; html: string }[]
}

/** One line of the shop's imprint: "Unvan" and its value. */
export interface IdentityRowView {
  label: string
  value: string
  /**
   * A number a visitor may need to copy (MERSİS, the tax number, the KEP
   * address): what goes to the clipboard and the copy button's name
   * ("MERSİS numarasını kopyala"). Left out for the rest.
   */
  copy?: { value: string; label: string }
}

/**
 * A card family's installment rates as the payment provider prices them
 * now (F5): from two installments up, the provider's surcharge in words
 * ("%3,49"), or that it adds nothing.
 */
export interface InstallmentRatesView {
  family: string
  options: { count: number; rate: string; free: boolean }[]
}

export interface PaymentFactsView {
  /** The ways to pay the shop offers now, as in the footer (derived, never typed in). */
  marks: ShopMarkView[]
  /** The card families' rates; none: the shop offers no installments now. */
  installments: InstallmentRatesView[]
  /** The most installments a card takes; null without installments. */
  maxInstallments: number | null
}

export interface ShippingFactsView {
  /** The carriers whose contract the shop connected. */
  carriers: ShopMarkView[]
  /** The shop's own promises (its trust badges). */
  promises: TrustBadgeView[]
}

/** One heading of a long text, for its table of contents: the anchor it carries and its words. */
export interface OutlineItemView {
  id: string
  label: string
}

/** One of the shop's legal texts on a page of its own (`/yasal/{tür}`, adr/0041). */
export interface LegalPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  /** The backend's own HTML (adr/0019), its `h2`s carrying the outline's ids. */
  html: string
  /** When this version came into force, in words ("5 Kasım 2026") and for `<time>`. */
  updated: { label: string; dateTime: string } | null
  /** The text's `h2`s in order; fewer than two: no table of contents. */
  outline: OutlineItemView[]
  /** The shop's other published legal texts. */
  others: LinkView[]
}

/** The storefront's contact form (adr/0047): a signed-in customer's name and address filled in. */
export interface ContactFormView {
  subjects: { value: string; label: string }[]
  name: string | null
  email: string | null
  /** The KVKK notice the form points to; null until the shop publishes one. */
  privacyPath: string | null
}

export interface ReviewsPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  average: number | null
  count: number
  /** The shop's reviews in short, shop-wide (adr/0046 Ek 2026-11-05); none: `average` and `count` only. */
  summary?: ShopRatingView | null
  reviews: (ReviewView & { product: ReviewedProductView | null })[]
  pagination: PaginationView
  /**
   * The star filter (adr/0037 Ek 2026-11-05): one number of stars at a
   * time, `/yorumlar?puan=5`. None: the theme shows no filter (a backend
   * without the shop-wide spread). `count` and `summary` stay shop-wide.
   */
  filter?: ReviewFilterView | null
}

export type ReviewStars = 1 | 2 | 3 | 4 | 5

/** The reviews page's star filter: a link per number of stars, the one shown, the way back to all. */
export interface ReviewFilterView {
  /** 5 to 1, each counted shop-wide; `path` null when no review gave that many (nothing to show). */
  options: {
    stars: ReviewStars
    count: number
    path: string | null
    /** For a screen reader: "Yalnız 5 yıldızlı değerlendirmeler (26)". */
    label: string
    active: boolean
  }[]
  /** The stars shown now; null: every review. */
  active: ReviewStars | null
  /** The active filter in words ("5 yıldız"); null with none. */
  activeLabel: string | null
  /** Every review again: `/yorumlar`. */
  clearPath: string
}

/** The product a review is about, at its page; its picture when it has one (adr/0046 Ek 2026-11-05). */
export interface ReviewedProductView extends LinkView {
  image?: ImageView | null
}

/** The 404 page's ways on: the shop's top categories as picture tiles (adr/0046 Ek 2026-11-05). */
export interface NotFoundPageView {
  categories: CategoryCardView[]
}
