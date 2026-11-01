import { z } from "@medusajs/framework/zod"
import { SEO_TEMPLATE_TOKENS, checkTemplate } from "../../../lib/seo"
import { FACET_TOKEN } from "../../../lib/seo/robots"
import { defineSection, isCleanText } from "./define"

// Lower-case DNS name with at least one dot; internationalised names as punycode
const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/
// robots.txt lines: a known directive, a comment or nothing (docs/13 §6); or the
// facet lines' place, written exactly as robots.txt generation looks for it
const ROBOTS_LINE = /^(?:|#.*|(?:user-agent|allow|disallow|sitemap|crawl-delay)[ \t]*:.*)$/i
const isRobotsLine = (line: string) => line.trim() === FACET_TOKEN || ROBOTS_LINE.test(line)
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

// `{sitemap_url}` is filled in when robots.txt is generated (F3.6); `{facet_disallow}`
// becomes a line per listing filter, sort and price parameter (F3.17)
export const DEFAULT_ROBOTS_TXT = [
  "User-agent: *",
  "Disallow: /sepet",
  "Disallow: /odeme",
  "Disallow: /hesap",
  "Disallow: /arama",
  "{facet_disallow}",
  "",
  "Sitemap: {sitemap_url}",
].join("\n")

function isRobotsTxt(text: string): boolean {
  const lines = text.split(/\r?\n/)
  return (
    Buffer.byteLength(text) <= MAX_ROBOTS_BYTES &&
    lines.length <= MAX_ROBOTS_LINES &&
    lines.every((line) => isRobotsLine(line) && isCleanText(line, true))
  )
}

type TemplateEntity = keyof typeof SEO_TEMPLATE_TOKENS
type UrlStyle = "prefixed" | "flat"

export interface SeoSettings {
  /** Lower-case host the storefront's canonical URLs use; null until a domain is set. */
  canonical_host: string | null
  /** docs/13 §2: `/urun/{slug}` (prefixed) or `/{slug}` (flat). */
  url_style: { product: UrlStyle; category: UrlStyle; brand: UrlStyle }
  title_templates: {
    product: string
    category: string
    brand: string
    page: string
    post: string
    landing: string
  }
  description_templates: { product: string }
  robots_txt: string
  ai_crawler_preset: "ai_search_visible" | "block_training" | "none"
  /** The share image of a page without its own (F12.10): one of the shop's media library. */
  default_og_image: string | null
  /** The home page's title and description (F18, adr/0046); null: the shop's name, no description. */
  home: { title: string | null; description: string | null }
}

/**
 * SEO settings (F2.3, docs/13): canonical host, URL style, title and
 * description templates, robots, the shop's share image (F12.10).
 */
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
        landing: template,
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
    // Checked against the media library when saved (update-platform-settings)
    default_og_image: z
      .string()
      .trim()
      .max(2048)
      .regex(/^https?:\/\/\S+$/i, { message: "platform_settings.url_invalid" })
      .nullable(),
    home: z
      .object({
        title: z
          .string()
          .trim()
          .min(1)
          .max(150)
          .refine((text) => isCleanText(text), cleanText)
          .nullable(),
        description: z
          .string()
          .trim()
          .min(1)
          .max(320)
          .refine((text) => isCleanText(text), cleanText)
          .nullable(),
      })
      .strict(),
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
      landing: "{başlık} | {mağaza}",
    },
    description_templates: { product: "{kısa_açıklama}. {fiyat_cümlesi} {kargo_cümlesi}" },
    robots_txt: DEFAULT_ROBOTS_TXT,
    ai_crawler_preset: "ai_search_visible",
    default_og_image: null,
    home: { title: null, description: null },
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
