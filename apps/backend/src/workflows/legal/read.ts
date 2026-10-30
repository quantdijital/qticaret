import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { Block, ContentDoc } from "../../lib/content"
import { renderDoc } from "../../lib/content"
import { LEGAL_KINDS, fillLegalDoc } from "../../lib/legal"
import type { LegalKind, OrderToken, ShopToken } from "../../lib/legal"
import { RETURN_WINDOW_DAYS } from "../../lib/orders/returns"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SeoSettings, StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

const DATE = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short" })

/**
 * The shop's values for its texts' tokens (adr/0041 §1). The legal identity
 * (title, MERSİS, tax number, address, KEP, ETBİS) comes with its settings
 * (F13.9); until then those show as "—".
 */
export async function shopLegalValues(
  container: Container
): Promise<Record<ShopToken, string | null>> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [store, seo, { data: stores }] = await Promise.all([
    settings.getSection("store") as Promise<unknown> as Promise<StoreSettings>,
    settings.getSection("seo") as Promise<unknown> as Promise<SeoSettings>,
    container
      .resolve(ContainerRegistrationKeys.QUERY)
      .graph({ entity: "store", fields: ["name"], pagination: { take: 1 } }),
  ])
  return {
    mağaza_adı: (stores[0] as { name?: string } | undefined)?.name ?? null,
    mağaza_unvanı: null,
    mersis: null,
    vkn: null,
    vergi_dairesi: null,
    adres: null,
    kep: null,
    etbis: null,
    e_posta: store.contact_email,
    telefon: store.contact_phone,
    alan_adı: seo.canonical_host,
    iade_süresi: String(RETURN_WINDOW_DAYS),
    bugün: DATE.format(new Date()),
  }
}

const cell = (text: string, header = false) => ({
  type: header ? ("tableHeader" as const) : ("tableCell" as const),
  content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }],
})

/** The order's lines as a table: what, how many, the line's total. */
export function linesTable(
  lines: readonly { title: string; quantity: number; total: string }[]
): Block {
  return {
    type: "table",
    content: [
      { type: "tableRow", content: [cell("Ürün", true), cell("Adet", true), cell("Tutar", true)] },
      ...lines.map((line) => ({
        type: "tableRow" as const,
        content: [cell(line.title), cell(String(line.quantity)), cell(line.total)],
      })),
    ],
  }
}

/** Made-up order values for a preview: never a real customer's. */
export const SAMPLE_ORDER: { text: Record<OrderToken, string>; blocks: Record<string, Block[]> } = {
  text: {
    alıcı_adı: "Ayşe Yılmaz",
    alıcı_e_posta: "ayse@ornek.com",
    alıcı_telefon: "+90 532 000 00 00",
    teslimat_adresi: "Örnek Mah. Örnek Sok. No: 1, Kadıköy / İstanbul",
    fatura_adresi: "Örnek Mah. Örnek Sok. No: 1, Kadıköy / İstanbul",
    sipariş_no: "#1001",
    sipariş_tarihi: "01.01.2026",
    sipariş_kalemleri: "",
    ara_toplam: "₺500,00",
    kargo_ücreti: "₺50,00",
    indirim: "₺0,00",
    toplam: "₺550,00",
    ödeme_yöntemi: "Kredi kartı",
  },
  blocks: {
    sipariş_kalemleri: [linesTable([{ title: "Örnek ürün", quantity: 2, total: "₺500,00" }])],
  },
}

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
  const full = (row: typeof published) =>
    row ? { ...summaryOf(row), body: row.body as unknown as ContentDoc } : null
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
