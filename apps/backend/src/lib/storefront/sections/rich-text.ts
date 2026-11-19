import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../../content"
import { image, placement, title } from "../layout-fields"
import { bodyFields } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The shop's own text, written in the content editor (adr/0019), drawn two
 * ways (adr/0073 §3): `pane`, today's heading beside the text, the default
 * a rich text saved before variants reads as; `with_image` ("Görselli
 * metin"), one of the media library's pictures (required, checked on
 * saving) on one side and the heading and text on the other. The title
 * and the document are every variant's and stay across a switch. The
 * footer group takes `pane` only (adr/0070 §4: no picture section there).
 *
 * Mirrors `@qticaret/types`' `RICH_TEXT_IMAGE_SIDES`; a unit test keeps them equal.
 */
export const RICH_TEXT_IMAGE_SIDES = ["start", "end"] as const

/** A side off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const imageSide = z
  .custom<(typeof RICH_TEXT_IMAGE_SIDES)[number]>(
    (value) => (RICH_TEXT_IMAGE_SIDES as readonly unknown[]).includes(value),
    VARIANT_ERROR
  )
  .default("start")

const common = { ...bodyFields, type: z.literal("rich_text"), title, body: contentDoc }

const pane = z.object({ ...common, variant: defaultVariant("rich_text") }).strict()

const withImage = z
  .object({ ...common, variant: z.literal("with_image"), image, image_side: imageSide })
  .strict()

/** What a rich text read as each variant keeps (`storedSection`). */
export const RICH_TEXT_BRANCHES: Readonly<Record<SectionVariant<"rich_text">, VariantBranch>> = {
  pane,
  with_image: withImage,
}

/** On the home, product and content pages. */
export const richText = z.discriminatedUnion("variant", [pane, withImage], VARIANT_ERROR)

/** On a category or content page: above or below its products or text. */
export const placedRichText = z.discriminatedUnion(
  "variant",
  [pane.extend({ placement }), withImage.extend({ placement })],
  VARIANT_ERROR
)

/** In the footer group, drawn above the footer on every page: the pane only. */
export const footerRichText = z.discriminatedUnion("variant", [pane], VARIANT_ERROR)

type AnyRichText = z.infer<typeof richText> | z.infer<typeof placedRichText>

/** The picture the variant shows beside the text (not the document's own): `with_image`'s. */
export const richTextImages = (section: AnyRichText): string[] =>
  section.variant === "with_image" ? [section.image.url] : []
