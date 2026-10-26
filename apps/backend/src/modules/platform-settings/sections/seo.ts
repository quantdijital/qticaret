import { z } from "@medusajs/framework/zod"
import { SEO_TEMPLATE_TOKENS, checkTemplate } from "../../../lib/seo"
import { defineSection, isCleanText } from "./define"

// Lower-case DNS name with at least one dot; internationalised names as punycode
const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/
// robots.txt lines: a known directive, a comment or nothing (docs/13 §6)
const ROBOTS_LINE = /^(?:|#.*|(?:user-agent|allow|disallow|sitemap|crawl-delay)[ \t]*:.*)$/i
const MAX_ROBOTS_BYTES = 8 * 1024
const MAX_ROBOTS_LINES = 500

const urlStyle = z.enum(["prefixed", "flat"])
const cleanText = { message: "platform_settings.text_invalid" }
const template = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((text) => isCleanText(text), cleanText)

// `{sitemap_url}` is filled in when robots.txt is generated (F3.6)
export const DEFAULT_ROBOTS_TXT = [
  "User-agent: *",
  "Disallow: /sepet",
  "Disallow: /odeme",
  "Disallow: /hesap",
  "Disallow: /arama",
  "Disallow: /*?sort=",
  "Disallow: /*?page=0",
  "",
  "Sitemap: {sitemap_url}",
].join("\n")

function isRobotsTxt(text: string): boolean {
  const lines = text.split(/\r?\n/)
  return (
    Buffer.byteLength(text) <= MAX_ROBOTS_BYTES &&
    lines.length <= MAX_ROBOTS_LINES &&
    lines.every((line) => ROBOTS_LINE.test(line) && isCleanText(line, true))
  )
}

type TemplateEntity = keyof typeof SEO_TEMPLATE_TOKENS
type UrlStyle = "prefixed" | "flat"

export interface SeoSettings {
  /** Lower-case host the storefront's canonical URLs use; null until a domain is set. */
  canonical_host: string | null
  /** docs/13 §2: `/urun/{slug}` (prefixed) or `/{slug}` (flat). */
  url_style: { product: UrlStyle; category: UrlStyle; brand: UrlStyle }
  title_templates: { product: string; category: string; brand: string; page: string; post: string }
  description_templates: { product: string }
  robots_txt: string
  ai_crawler_preset: "ai_search_visible" | "block_training" | "none"
}

/** SEO settings (F2.3, docs/13): canonical host, URL style, title and description templates, robots. */
export const seoSection = defineSection<SeoSettings>(
  "seo",
  {
    canonical_host: z
      .string()
      .trim()
      .toLowerCase()
      .regex(HOSTNAME, { message: "platform_settings.host_invalid" })
      .nullable(),
    url_style: z.object({ product: urlStyle, category: urlStyle, brand: urlStyle }).strict(),
    title_templates: z
      .object({
        product: template,
        category: template,
        brand: template,
        page: template,
        post: template,
      })
      .strict(),
    description_templates: z
      .object({
        product: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .refine((text) => isCleanText(text), cleanText),
      })
      .strict(),
    robots_txt: z.string().refine(isRobotsTxt, { message: "platform_settings.robots_invalid" }),
    ai_crawler_preset: z.enum(["ai_search_visible", "block_training", "none"]),
  },
  {
    canonical_host: null,
    url_style: { product: "prefixed", category: "prefixed", brand: "prefixed" },
    // docs/13 §3
    title_templates: {
      product: "{ürün_adı} | {marka} | {mağaza}",
      category: "{kategori} Modelleri ve Fiyatları | {mağaza}",
      brand: "{marka} Ürünleri | {mağaza}",
      page: "{başlık} | {mağaza}",
      post: "{başlık} | {mağaza}",
    },
    description_templates: { product: "{kısa_açıklama}. {fiyat_cümlesi} {kargo_cümlesi}" },
    robots_txt: DEFAULT_ROBOTS_TXT,
    ai_crawler_preset: "ai_search_visible",
  },
  (values, ctx) => {
    const templates: [string, TemplateEntity, string][] = [
      ...(Object.entries(values.title_templates) as [TemplateEntity, string][]).map(
        ([entity, text]): [string, TemplateEntity, string] => [
          `title_templates.${entity}`,
          entity,
          text,
        ]
      ),
      ["description_templates.product", "product", values.description_templates.product],
    ]
    for (const [field, entity, text] of templates) {
      const { unknownTokens, isMalformed } = checkTemplate(text, SEO_TEMPLATE_TOKENS[entity])
      if (isMalformed || unknownTokens.length > 0) {
        ctx.addIssue({ code: "custom", message: "seo.template_invalid", path: field.split(".") })
      }
    }
  }
)
