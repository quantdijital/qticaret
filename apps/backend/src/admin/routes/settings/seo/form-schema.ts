import { z } from "zod"
import { SEO_TEMPLATE_TOKENS, checkTemplate } from "../../../../lib/seo"
import type { SeoSettings } from "../../../../modules/platform-settings/sections"

/**
 * The SEO form's own checks, mirroring the server's for a quicker answer;
 * the server checks again and has the last word. Messages are i18n keys.
 */

type Entity = keyof typeof SEO_TEMPLATE_TOKENS

const template = (entity: Entity, max: number) =>
  z
    .string()
    .trim()
    .min(1, "qticaret.serverErrors.platform_settings.invalid")
    .max(max, "qticaret.serverErrors.platform_settings.invalid")
    .refine((text) => {
      const { unknownTokens, isMalformed } = checkTemplate(text, SEO_TEMPLATE_TOKENS[entity])
      return !isMalformed && unknownTokens.length === 0
    }, "qticaret.serverErrors.seo.template_invalid")

const urlStyle = z.enum(["prefixed", "flat"])

export const seoFormSchema = z.object({
  // Empty means "not set yet"
  canonical_host: z.string().trim().toLowerCase().max(253),
  url_style: z.object({ product: urlStyle, category: urlStyle, brand: urlStyle }),
  title_templates: z.object({
    product: template("product", 200),
    category: template("category", 200),
    brand: template("brand", 200),
    page: template("page", 200),
    post: template("post", 200),
  }),
  description_templates: z.object({ product: template("product", 300) }),
  robots_txt: z.string().max(8 * 1024, "qticaret.serverErrors.platform_settings.robots_invalid"),
  ai_crawler_preset: z.enum(["ai_search_visible", "block_training", "none"]),
})

export type SeoForm = z.infer<typeof seoFormSchema>

export const toForm = (values: SeoSettings): SeoForm => ({
  ...values,
  canonical_host: values.canonical_host ?? "",
})

export const toApi = (form: SeoForm): SeoSettings => ({
  ...form,
  canonical_host: form.canonical_host === "" ? null : form.canonical_host,
})
