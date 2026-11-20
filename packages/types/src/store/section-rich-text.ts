import type { MediaDerivatives } from "./catalog.js"
import type { StoreLayoutImage } from "./layout.js"
import type { RichTextVariant } from "./section-variants.js"

/**
 * The rich text's own fields by variant (adr/0073 §3, "Görselli metin").
 * `pane` has none beyond the title and the text, which every variant
 * shares and keeps across a switch; `with_image` adds one of the media
 * library's pictures (required, checked on saving) and the side it stands
 * on from 1024 px (`start`, the default, or `end`); on a phone the picture
 * is on top whatever the side.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-rich-text` subpath, which Turbopack resolves).
 * Mirrored by the backend's `sections/rich-text.ts`; a test keeps them equal.
 */
export const RICH_TEXT_IMAGE_SIDES = ["start", "end"] as const

export type RichTextImageSide = (typeof RICH_TEXT_IMAGE_SIDES)[number]

/** The picture's side where none is set: the drawing's first. */
export const RICH_TEXT_IMAGE_SIDE_DEFAULT: RichTextImageSide = "start"

/** The variants the footer group's rich text takes (adr/0070 §4: no picture section there). */
export const RICH_TEXT_FOOTER_VARIANTS = ["pane"] as const satisfies readonly RichTextVariant[]

/** Whether the footer group's rich text may take the variant. */
export const richTextInFooter = (variant: RichTextVariant): boolean =>
  (RICH_TEXT_FOOTER_VARIANTS as readonly string[]).includes(variant)

/**
 * The variants only a content page's rich text takes (adr/0073 Ek
 * 2026-11-19 (2) K2): `article`, the page's own text. The home, product,
 * category and footer groups take the others.
 */
export const RICH_TEXT_PAGE_VARIANTS = ["article"] as const satisfies readonly RichTextVariant[]

/** Whether a rich text outside the content pages may take the variant. */
export const richTextOffPages = (variant: RichTextVariant): boolean =>
  !(RICH_TEXT_PAGE_VARIANTS as readonly string[]).includes(variant)

/**
 * The page text's two switches (`article`): `auto`, the drawing from
 * before the text was a section (an outline beside a long text, grouped
 * questions in a questions-and-answers text) and the default; `off`.
 */
export const PAGE_TEXT_SWITCHES = ["auto", "off"] as const

export type PageTextSwitch = (typeof PAGE_TEXT_SWITCHES)[number]

/** A switch as a reader takes it: absent or off the list, `auto`. */
export const pageTextSwitchOf = (value: unknown): PageTextSwitch =>
  PAGE_TEXT_SWITCHES.find((each) => each === value) ?? "auto"

/** A picture inside a text, with its size and versions (as `GET /store/content/:id` gives them). */
export interface StoreTextImage {
  url: string
  width: number | null
  height: number | null
  derivatives: MediaDerivatives | null
}

/** A heading of a text, for its outline. */
export interface StoreTextHeading {
  level: 2 | 3 | 4
  text: string
}

/** The picture's side as a reader takes it: absent or off the list, the default. */
export const richTextImageSideOf = (value: unknown): RichTextImageSide =>
  RICH_TEXT_IMAGE_SIDES.find((each) => each === value) ?? RICH_TEXT_IMAGE_SIDE_DEFAULT

/**
 * The rich text as the store API prints it: today's title and HTML (the
 * backend's, from its allow-listed document schema, adr/0019), then the
 * variant's own only off the default, so a `pane` prints as it did before
 * variants. The storefront reads a variant it does not know as `pane`
 * (`variantOf`).
 */
export interface StoreRichTextSection {
  id: string
  type: "rich_text"
  title: string | null
  html: string
  /** Absent: `pane`. */
  variant?: RichTextVariant
  /** `with_image`: the picture, filled from the media library (its alt the shop's, else the library's). */
  image?: StoreLayoutImage | null
  /** `with_image`: the picture's side from 1024 px; absent: `start`. */
  image_side?: RichTextImageSide
  /** `article`: the outline beside a long text; absent: `auto`. */
  outline?: PageTextSwitch
  /** `article`: a questions-and-answers text read as grouped questions; absent: `auto`. */
  questions?: PageTextSwitch
  /** `article`: the text's library pictures, their size and versions. */
  images?: StoreTextImage[]
  /** `article`: the text's headings, for the outline. */
  headings?: StoreTextHeading[]
}
