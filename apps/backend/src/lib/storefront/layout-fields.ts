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

export const LAYOUT_LIMITS = {
  home: 30,
  product: 12,
  category: 12,
  header: 3,
  footer: 3,
  items: 24,
  slides: 6,
  faq: 12,
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
