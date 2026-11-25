import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../../../../lib/security"
import { SEO_META_LIMITS, isSitePath, normalizeFocusKeywords } from "../../../../../lib/seo"
import { ROBOTS_OVERRIDES } from "../../../../../modules/seo-meta/models/seo-meta"

// An empty field clears the override: the page falls back to the template
const emptyToNull = (value: string | null) => (value === "" ? null : value)

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "seo.text_too_long" })
    .refine((value) => isCleanText(value), { message: "seo.text_invalid" })
    .nullable()
    .transform(emptyToNull)
    .optional()

/**
 * A page's SEO fields (adr/0015). Fields left out keep their values, null or
 * "" clears one. Length caps keep data sane; SERP targets are the advisor's.
 */
export const AdminPutSeoMeta = z
  .object({
    seo_title: text(SEO_META_LIMITS.seo_title),
    seo_description: text(SEO_META_LIMITS.seo_description),
    // A list kept as "primary, other, …": repeats and empties dropped on the way in
    focus_keyword: text(SEO_META_LIMITS.focus_keyword).transform((value) =>
      value === undefined ? undefined : normalizeFocusKeywords(value)
    ),
    canonical_override: z
      .string()
      .trim()
      .nullable()
      .transform(emptyToNull)
      .refine((value) => value === null || isSitePath(value), { message: "seo.canonical_invalid" })
      .optional(),
    robots_override: z.enum(ROBOTS_OVERRIDES).nullable().optional(),
    // A file id from the shop's own uploads; checked to exist in the workflow
    og_image_override: z.string().trim().max(64).nullable().transform(emptyToNull).optional(),
    og_image_alt: text(SEO_META_LIMITS.og_image_alt),
  })
  .strict()
export type AdminPutSeoMetaType = z.infer<typeof AdminPutSeoMeta>
