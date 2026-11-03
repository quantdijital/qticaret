import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { composeSms } from "../../lib/campaigns/sms"
import { fillName } from "../../lib/campaigns/tokens"
import { campaignLink } from "../../lib/campaigns/utm"
import { MAX_PRODUCT_CARDS, emailBlocksOf, mapBlockTexts } from "../../lib/campaigns/email-doc"
import { docStats } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import { MESSAGE_TEMPLATES } from "../../lib/messaging/templates"
import type { Brand, CampaignVars, EmailContent } from "../../lib/messaging/templates"
import type { EmailBlock, EmailProductCard } from "../../lib/messaging/templates/layout"
import { messageText } from "../../lib/messaging/texts"
import { fillShopText } from "../../lib/shop/tokens"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { LegalSettings, MarketingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { brandOf } from "../messaging/brand"
import { GREETING, personName } from "../messaging/loaders/types"
import { priceDisplays } from "../pricing/price-display"
import { PRODUCT_FACT_FIELDS, productFacts } from "../seo/facts"
import type { FactRow } from "../seo/facts"
import { shopInfoValues } from "../shop/info-values"

/** What a campaign's message is made from: its record's own fields. */
export interface CampaignContent {
  channel: "email" | "sms"
  subject: string | null
  preheader: string | null
  body: unknown
  sms_text: string | null
  utm_campaign: string
}

/** The message every recipient shares, the shop's details in place; `{ad}` still to fill. */
export interface PreparedCampaign {
  subject: string
  preheader: string
  blocks: EmailBlock[]
  legal: string | null
  sms: string
}

const lira = (amount: number): string =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)

/** The active storefront paths of these records. */
async function pathsOf(container: MedusaContainer, entityType: string, ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, string>()
  }
  const entries = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      { locale: CATALOG_LOCALE, entity_type: entityType, entity_id: ids, status: "active" },
      { select: ["entity_id", "path"], take: ids.length }
    )
  return new Map(entries.map((entry) => [entry.entity_id, entry.path]))
}

/**
 * The cards' products as they sell now (adr/0050 §4): published only, the
 * cheapest variant's price and, where the 30-day rule allows, the price
 * struck through, from the facts the product page's JSON-LD is built from.
 */
async function productCards(
  container: MedusaContainer,
  ids: string[],
  link: (href: string) => string | null
): Promise<Map<string, EmailProductCard>> {
  if (ids.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "title", "thumbnail", ...PRODUCT_FACT_FIELDS],
    filters: { id: ids, status: "published" },
  })
  const rows = data as (FactRow & { id: string })[]
  const variants = rows.flatMap((row) => (row.variants ?? []).flatMap((each) => each?.id ?? []))
  const [displays, paths] = await Promise.all([
    priceDisplays(container, variants, "try"),
    pathsOf(container, CATALOG_ENTITY_TYPES.product, ids),
  ])
  const cards = new Map<string, EmailProductCard>()
  for (const row of rows) {
    const facts = productFacts(row, null, "", displays)
    const [cheapest] = facts.variants
      .filter((variant) => variant.price !== null)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    const path = paths.get(row.id)
    cards.set(row.id, {
      title: facts.name,
      url: path ? link(path) : null,
      image: facts.images[0] ?? null,
      price: cheapest?.price ? lira(cheapest.price) : null,
      before: cheapest?.strikethrough ? lira(cheapest.strikethrough) : null,
    })
  }
  return cards
}

async function categoryLinks(
  container: MedusaContainer,
  ids: string[],
  link: (href: string) => string | null
) {
  if (ids.length === 0) {
    return new Map<string, { title: string; url: string | null }>()
  }
  const [{ data }, paths] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product_category",
      fields: ["id", "name"],
      filters: { id: ids },
    }),
    pathsOf(container, CATALOG_ENTITY_TYPES.category, ids),
  ])
  return new Map(
    (data as { id: string; name: string }[]).map((row) => {
      const path = paths.get(row.id)
      return [row.id, { title: row.name, url: path ? link(path) : null }] as const
    })
  )
}

/** The shop's title and MERSİS for the footer (adr/0050 §4); null while neither is set. */
export function legalLine(legal: Pick<LegalSettings, "company_title" | "mersis">): string | null {
  const parts = [
    legal.company_title,
    legal.mersis ? messageText("campaign.mersis", { mersis: legal.mersis }) : null,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(" · ") : null
}

// Addresses written in a text, for their utm (adr/0050 §4)
const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/gi

/** The campaign as every recipient gets it, read now: prices, paths, the shop's details. */
export async function prepareCampaign(
  container: MedusaContainer,
  campaign: CampaignContent
): Promise<PreparedCampaign> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [brand, values, legal, marketing] = await Promise.all([
    brandOf(container),
    shopInfoValues(container),
    settings.getSection("legal") as Promise<unknown> as Promise<LegalSettings>,
    settings.getSection("marketing") as Promise<unknown> as Promise<MarketingSettings>,
  ])
  const fill = (text: string) => fillShopText(text, values)
  const link = (href: string) =>
    campaignLink(href, brand.storefrontUrl, campaign.channel, campaign.utm_campaign)
  if (campaign.channel === "sms") {
    const text = fill(campaign.sms_text ?? "").replace(URL_IN_TEXT, (url) => link(url) ?? url)
    return {
      subject: "",
      preheader: "",
      blocks: [],
      legal: null,
      sms: composeSms(text, brand.shopName, marketing.sms_opt_out_text ?? ""),
    }
  }
  const doc = (campaign.body ?? { type: "doc", content: [] }) as ContentDoc
  const { cards } = docStats(doc)
  const [products, categories] = await Promise.all([
    productCards(container, [...new Set(cards.product)].slice(0, MAX_PRODUCT_CARDS), link),
    categoryLinks(container, [...new Set(cards.category)], link),
  ])
  return {
    subject: fill(campaign.subject ?? ""),
    preheader: fill(campaign.preheader ?? ""),
    blocks: emailBlocksOf(doc, { link, fill, products, categories }),
    legal: legalLine(legal),
    sms: "",
  }
}

/**
 * The message for one recipient: their first name for `{ad}` when a
 * customer record gives one that passes the link filter (adr/0036 Ek),
 * else the greeting every shopper gets.
 */
export function personalise(
  prepared: PreparedCampaign,
  firstName: string | null,
  test = false
): CampaignVars {
  const name = personName(firstName) ?? GREETING
  const fillOne = (text: string) => fillName(text, name)
  return {
    subject: fillOne(prepared.subject),
    preheader: fillOne(prepared.preheader),
    blocks: mapBlockTexts(prepared.blocks, fillOne),
    legal: prepared.legal,
    sms: fillOne(prepared.sms),
    test,
  }
}

/** What a message carries: an e-mail's subject, HTML and text, or a text alone. */
export type RenderedCampaign =
  { channel: "email"; email: EmailContent } | { channel: "sms"; text: string }

/**
 * The message for one recipient as `marketing.campaign` makes it, the
 * same call deliver() makes for every send of the dispatch (its `render`):
 * the test send and the preview go through it, so neither can differ from
 * what goes out. An e-mail carries its way out at `unsubscribeUrl`; a
 * text has its opt-out line written in (composeSms).
 */
export function renderCampaign(
  channel: "email" | "sms",
  vars: CampaignVars,
  brand: Brand,
  unsubscribeUrl: string | null
): RenderedCampaign {
  const template = MESSAGE_TEMPLATES["marketing.campaign"]
  if (channel === "sms") {
    return { channel, text: template.sms?.(vars, brand) ?? "" }
  }
  if (!template.email) {
    throw new Error("campaigns: marketing.campaign has no e-mail form")
  }
  return { channel, email: template.email(vars, brand, { unsubscribeUrl }) }
}
