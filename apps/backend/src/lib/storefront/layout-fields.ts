import { z } from "@medusajs/framework/zod"
import { isStorageUrl } from "../security/https-url"
import { isCleanText } from "../security/text"
import { unknownShopTokens } from "../shop/tokens"
import { isShopPath } from "./menus"

/**
 * What the storefront design's sections (adr/0049, `layout-sections.ts`)
 * are made of: their limits, plain text (the shop's details as
 * `{belirteç}`s, adr/0048), record ids, the media library's images, and
 * the settings every section has. No HTML, CSS or scripts.
 */

/**
 * How many sections a group holds; the product and category pages' main
 * section (adr/0049 Ek 2026-11-14 §7) comes on top of theirs.
 */
export const LAYOUT_LIMITS = {
  home: 30,
  product: 12,
  category: 12,
  /** The strips, the header bar and the usage menu, each once (adr/0049 Ek 2026-11-14 §5). */
  header: 5,
  /** The bar and above it a box, a rich text, trust badges, a strip (adr/0070 §4). */
  footer: 5,
  /**
   * Content pages with an entry in the design, and sections on one, its
   * text sections among them (adr/0073 Ek 2026-11-19 (2) K1).
   */
  pages: 50,
  page: 12,
  items: 24,
  slides: 6,
  related: 12,
} as const

export const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => isCleanText(value), { message: "storefront_layout.text_invalid" })

/** A line that may stand for the shop's details (adr/0048). */
export const shopText = (max: number) =>
  text(max).refine((value) => unknownShopTokens(value).length === 0, {
    message: "storefront_layout.token_unknown",
  })

export const optional = <T extends z.ZodType>(schema: T) => schema.nullable().default(null)

export const recordId = z.string().regex(/^[a-z]+_[0-9A-Za-z]{1,40}$/, {
  message: "storefront_layout.target_invalid",
})

/**
 * An image of the shop's media library: its storage's address (plain http
 * on a developer's machine, https deployed) or a path on the shop; the
 * save checks it is one of its uploads.
 */
export const image = z
  .object({
    url: z
      .string()
      .trim()
      .refine((value) => isCleanText(value) && (isStorageUrl(value) || isShopPath(value)), {
        message: "storefront_layout.image_invalid",
      }),
    alt: optional(text(300)),
  })
  .strict()

export const base = {
  /** The panel's own id for the section: stable while it is moved. */
  id: z.string().regex(/^[a-z0-9]{6,24}$/, { message: "storefront_layout.section_invalid" }),
  visible: z.boolean().default(true),
  /** Shown only from, and until, these moments (campaigns); none: always. */
  starts_at: optional(z.iso.datetime({ offset: true })),
  ends_at: optional(z.iso.datetime({ offset: true })),
}

/**
 * Which screens show a section (docs/tema/bilesen-standardi §2): everywhere,
 * phones only (the theme's narrow frame) or wide screens only. Mirrors
 * `@qticaret/types`' `SECTION_DEVICES`; a unit test keeps them equal. The
 * scrolling strip had it alone before, under the same key: its saved step
 * reads as it is.
 */
export const SECTION_DEVICES = ["all", "mobile", "desktop"] as const
export type SectionDevice = (typeof SECTION_DEVICES)[number]

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
export const device = z
  .custom<SectionDevice>((value) => (SECTION_DEVICES as readonly unknown[]).includes(value), {
    error: "storefront_layout.section_invalid",
  })
  .default("all")

/** What the storefront is given: the screens only when not everywhere, so a section prints as before. */
export const shownDevice = (value: SectionDevice): { device?: SectionDevice } =>
  value === "all" ? {} : { device: value }

export const title = optional(text(60))

/**
 * How many cards a product rail stands in a row on a wide screen (adr/0049
 * Ek 2026-11-05, grid columns): three, four or five; three by default,
 * the look before the setting. The theme steps down on narrower screens.
 * Only a stale or forged editor sends another count: a section not recognised.
 */
export const columns = z
  .union([z.literal(3), z.literal(4), z.literal(5)], {
    error: "storefront_layout.section_invalid",
  })
  .default(3)

/**
 * Cards in a row on a phone (docs/tema/bilesen-denetimi (b) 3, the
 * dictionary's `columns_mobile`) for a grid rail and the related products:
 * one or two, two by default (the look before the setting). Mirrors
 * `@qticaret/types`' `SHELF_PHONE_COLUMNS`; a unit test keeps them equal.
 */
export const SHELF_PHONE_COLUMNS = [1, 2] as const
export const SHELF_PHONE_DEFAULT = 2

/** A count off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
export const columnsMobile = z
  .custom<(typeof SHELF_PHONE_COLUMNS)[number]>(
    (value) => (SHELF_PHONE_COLUMNS as readonly unknown[]).includes(value),
    { error: "storefront_layout.section_invalid" }
  )
  .default(SHELF_PHONE_DEFAULT)

/** Where a category page shows a section: above its product grid or below it. */
export const placement = z.enum(["top", "bottom"]).default("bottom")
