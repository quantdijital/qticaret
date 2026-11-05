import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { Block, ContentDoc } from "../../lib/content"
import { renderDoc } from "../../lib/content"
import { LEGAL_KINDS, fillLegalDoc, orderLegalValues, shopTokenValues } from "../../lib/legal"
import type { LegalKind, OrderLegalValues, ShopToken } from "../../lib/legal"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SeoSettings, ShippingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { storefrontUrlOf } from "../messaging/brand"
import { returnPolicy } from "../returns/policy"
import { legalIdentity } from "./identity"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The shop's values for its texts' tokens (adr/0041 §1): its legal identity
 * and contact details, its site (the canonical domain; the dev storefront's
 * on a developer's machine), its withdrawal period and its shipping days,
 * each as a reader reads it (`shopTokenValues`).
 */
export async function shopLegalValues(
  container: Container
): Promise<Record<ShopToken, string | null>> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [identity, policy, seo, shipping, { data: stores }] = await Promise.all([
    legalIdentity(container),
    returnPolicy(container),
    settings.getSection("seo") as Promise<unknown> as Promise<SeoSettings>,
    settings.getSection("shipping") as Promise<unknown> as Promise<ShippingSettings>,
    container
      .resolve(ContainerRegistrationKeys.QUERY)
      .graph({ entity: "store", fields: ["name"], pagination: { take: 1 } }),
  ])
  return shopTokenValues({
    ...identity,
    store_name: (stores[0] as { name?: string } | undefined)?.name,
    storefront_url: storefrontUrlOf(seo.canonical_host),
    withdrawal_days: policy.withdrawal_days,
    handling_days: { min: shipping.handling_days_min, max: shipping.handling_days_max },
    transit_days: { min: shipping.transit_days_min, max: shipping.transit_days_max },
    today: new Date(),
  })
}

/**
 * Made-up order values for a preview, never a real customer's: filled the
 * way an order's are, so the preview prints what a contract will.
 */
export const SAMPLE_ORDER: OrderLegalValues = orderLegalValues({
  display_id: 1001,
  created_at: "2026-01-01T07:30:00.000Z",
  email: "ayse@ornek.com",
  item_total: 500,
  shipping_total: 50,
  discount_total: 0,
  total: 550,
  items: [{ product_title: "Örnek ürün", quantity: 2, total: 500 }],
  shipping_address: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    address_1: "Örnek Sok. No: 1",
    address_2: "Örnek Mah.",
    city: "Kadıköy",
    province: "İstanbul",
    postal_code: "34710",
    phone: "+905320000000",
  },
  billing_address: null,
  payment: "card",
})

/** The text as HTML, its tokens filled: the shop's, and an order's when given. */
export async function renderLegal(
  container: Container,
  body: ContentDoc,
  order?: { text: Record<string, string | null>; blocks: Record<string, Block[]> }
): Promise<string> {
  const shop = await shopLegalValues(container)
  return renderDoc(
    fillLegalDoc(body, {
      text: { ...order?.text, ...shop },
      ...(order ? { blocks: order.blocks } : {}),
    })
  )
}

const legal = (container: Container) => container.resolve<LegalModuleService>(LEGAL_MODULE)

const summaryOf = (row: {
  id: string
  version: number
  title: string
  updated_at: Date | string
  published_at: Date | string | null
}) => ({
  id: row.id,
  version: row.version,
  title: row.title,
  updated_at: new Date(row.updated_at).toISOString(),
  published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
})

/** A version as the panel's editor takes it: its summary and its document. */
export const fullVersionOf = (row: Parameters<typeof summaryOf>[0] & { body: unknown }) => ({
  ...summaryOf(row),
  body: row.body as ContentDoc,
})

/** Each kind's published version and draft, for the panel's list (F13.1). */
export async function legalOverview(container: Container) {
  const rows = await legal(container).listLegalDocuments(
    { status: ["draft", "published"] },
    { select: ["id", "kind", "version", "status", "title", "updated_at", "published_at"] }
  )
  return LEGAL_KINDS.map((kind) => {
    const of = (status: string) => rows.find((row) => row.kind === kind && row.status === status)
    const published = of("published")
    const draft = of("draft")
    return {
      kind,
      published: published ? summaryOf(published) : null,
      draft: draft ? summaryOf(draft) : null,
    }
  })
}

/** A kind's published text and draft in full, and every version it had. */
export async function legalKind(container: Container, kind: LegalKind) {
  const service = legal(container)
  const [published, draft, history] = await Promise.all([
    service.versionOf(kind, "published"),
    service.versionOf(kind, "draft"),
    service.listLegalDocuments(
      { kind, status: ["published", "retired"] },
      {
        order: { version: "DESC" },
        select: ["id", "version", "status", "title", "published_at", "published_by", "updated_at"],
      }
    ),
  ])
  const full = (row: typeof published) => (row ? fullVersionOf(row) : null)
  return {
    kind,
    published: full(published),
    draft: full(draft),
    history: history.map((row) => ({
      ...summaryOf(row),
      status: row.status,
      published_by: row.published_by ?? null,
    })),
  }
}
