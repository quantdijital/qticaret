import { z } from "@medusajs/framework/zod"
import { base, image, optional, placement, shopText, title } from "../layout-fields"
import { bodyFields } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The newsletter box (adr/0049 Ek 2026-11-17 e-bülten), on a page or in
 * the footer. `text` keeps its meaning: the consent sentence, the box's
 * label (İYS, double opt-in). `description`, the line beside the heading,
 * is every variant's, kept across a switch (the standard drawing never shows it);
 * the promise line (`note`, `show_note`) is `split`'s and `image_card`'s,
 * the picture (one of the media library's uploads, checked on saving)
 * `image_card`'s. `in_footer` is the footer's box only: a page has no
 * footer column. Each branch is its own (adr/0049 Ek 2026-11-14 §2,
 * option B), the default filled when a box has no variant.
 *
 * Mirrors `@qticaret/types`' `NEWSLETTER_LIMITS`; a unit test keeps them equal.
 */
export const NEWSLETTER_LIMITS = { description: 240, note: 80 } as const

/** The boxed bands' ground: the theme's pane, or a wash of the shop's main colour. Mirrors `@qticaret/types`. */
export const NEWSLETTER_TONES = ["plain", "tint"] as const

/** Absent: `plain`, so a box saved before it reads and prints as it did. */
const tone = { tone: z.enum(NEWSLETTER_TONES).optional() }

const words = {
  type: z.literal("newsletter"),
  title,
  text: optional(shopText(240)),
  description: optional(shopText(NEWSLETTER_LIMITS.description)),
}

const promise = {
  note: optional(shopText(NEWSLETTER_LIMITS.note)),
  show_note: z.boolean().default(true),
}

/** The branches over a group's own fields: a page's (look, screens) or the footer's (none). */
function branches<F extends z.ZodRawShape>(fields: F) {
  const common = { ...fields, ...words }
  return {
    standard: z.object({ ...common, variant: defaultVariant("newsletter") }).strict(),
    split: z.object({ ...common, variant: z.literal("split"), ...promise, ...tone }).strict(),
    image_card: z
      .object({
        ...common,
        variant: z.literal("image_card"),
        ...promise,
        image: optional(image),
        ...tone,
      })
      .strict(),
    strip: z.object({ ...common, variant: z.literal("strip"), ...tone }).strict(),
    in_footer: z.object({ ...common, variant: z.literal("in_footer") }).strict(),
  }
}

const page = branches(bodyFields)
const footer = branches(base)

/** What a box read as each variant keeps (`storedSection`): a page's, the footer's column one too. */
export const NEWSLETTER_BRANCHES: Readonly<Record<SectionVariant<"newsletter">, VariantBranch>> = {
  standard: page.standard,
  split: page.split,
  image_card: page.image_card,
  strip: page.strip,
  in_footer: footer.in_footer,
}

/** A page's box: every variant but the footer's column one. */
export const newsletter = z.discriminatedUnion(
  "variant",
  [page.standard, page.split, page.image_card, page.strip],
  VARIANT_ERROR
)

/** On a category page: above or below its products. */
export const placedNewsletter = z.discriminatedUnion(
  "variant",
  [
    page.standard.extend({ placement }),
    page.split.extend({ placement }),
    page.image_card.extend({ placement }),
    page.strip.extend({ placement }),
  ],
  VARIANT_ERROR
)

/**
 * The footer box's bands' own setting (adr/0070 §4 Ek): under the free rows
 * footer the band is drawn on the footer's ground as its top band, as the
 * ledger and the brand columns draw it, instead of a page's box above the
 * footer. Absent or false: above the footer, as it was; the other footers
 * draw their band inside them whatever it says. A page's box has no footer.
 */
const joined = { joined: z.boolean().optional() }

/** The footer's box: no look of its own (the footer's frame is adr/0049 §9 V3's). */
export const footerNewsletter = z.discriminatedUnion(
  "variant",
  [
    footer.standard,
    footer.split.extend(joined),
    footer.image_card.extend(joined),
    footer.strip.extend(joined),
    footer.in_footer,
  ],
  VARIANT_ERROR
)

type AnyNewsletter =
  z.infer<typeof newsletter> | z.infer<typeof placedNewsletter> | z.infer<typeof footerNewsletter>

/** The picture a box shows: `image_card`'s, when it has one. */
export const newsletterImages = (section: AnyNewsletter): string[] =>
  section.variant === "image_card" && section.image ? [section.image.url] : []

/**
 * The box as the store API prints it: today's title and consent sentence
 * (filled), then each new field only off its default, so a box from
 * before the variants prints as it did (adr/0049 Ek 2026-11-14 §2).
 */
export function printedNewsletter<I>(
  section: AnyNewsletter,
  fill: (text: string | null) => string | null,
  picture: (url: string, alt: string | null) => I
) {
  const { id, type } = section
  return {
    id,
    type,
    title: section.title,
    text: fill(section.text),
    ...(section.variant === "standard" ? {} : { variant: section.variant }),
    ...(section.description ? { description: fill(section.description) } : {}),
    ...(section.variant === "split" || section.variant === "image_card"
      ? {
          ...(section.note ? { note: fill(section.note) } : {}),
          ...(section.show_note ? {} : { show_note: false }),
        }
      : {}),
    ...(section.variant === "image_card" && section.image
      ? { image: { ...picture(section.image.url, section.image.alt), alt: section.image.alt } }
      : {}),
    // The footer's band on the footer's ground (adr/0070 §4 Ek), only when set
    ...("joined" in section && section.joined === true ? { joined: true } : {}),
    // The boxed bands' wash of the main colour, only when set
    ...("tone" in section && section.tone === "tint" ? { tone: "tint" as const } : {}),
  }
}
