import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { invoiceDraft, invoiceLines, invoiceTotals } from "../../lib/invoicing"
import type { DraftResult, InvoiceOrder, InvoiceProfile } from "../../lib/invoicing"
import { carrierOf } from "../../lib/shipping/carriers"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { BILLING_PROFILE_MODULE } from "../../modules/billing-profile"
import type BillingProfileModuleService from "../../modules/billing-profile/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { InvoicingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

const TOTALS = ["subtotal", "discount_subtotal", "tax_total", "total", "tax_lines.rate"]
const ADDRESS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "phone",
]

/** The order's lines as the invoice reads them: no buyer in them. */
const LINE_FIELDS = [
  "id",
  "currency_code",
  // Medusa totals the lines only when the order's own total is asked for
  "total",
  ...[
    "title",
    "product_title",
    "variant_title",
    "variant_id",
    "is_custom_price",
    "metadata",
    "quantity",
    ...TOTALS,
  ].map((field) => `items.${field}`),
  ...["name", ...TOTALS].map((field) => `shipping_methods.${field}`),
]

type OrderRow = InvoiceOrder & {
  customer_id?: string | null
  customer?: {
    billing_profile?: {
      id: string
      type: InvoiceProfile["type"]
      legal_name: string
      tax_office: string | null
    } | null
  } | null
  fulfillments?:
    | ({
        provider_id?: string | null
        shipped_at?: string | Date | null
        canceled_at?: string | Date | null
      } | null)[]
    | null
}

const query = (container: Container) => container.resolve(ContainerRegistrationKeys.QUERY)

/** What an order's invoice comes to, for its record when it is queued (no buyer read). */
export async function invoiceTotalsOf(container: Container, orderId: string) {
  const { data } = await query(container).graph({
    entity: "order",
    fields: LINE_FIELDS,
    filters: { id: orderId },
  })
  const order = data[0] as InvoiceOrder | undefined
  return order
    ? { currency: order.currency_code ?? "", totals: invoiceTotals(invoiceLines(order)) }
    : null
}

async function settingsOf(container: Container) {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [invoicing, seo] = await Promise.all([
    settings.readSection("invoicing"),
    settings.readSection("seo"),
  ])
  const host = (seo.values as { canonical_host?: string | null }).canonical_host
  return {
    carriers: (invoicing.values as unknown as InvoicingSettings).carriers,
    store_url: host ? `https://${host}` : null,
  }
}

/**
 * The buyer's invoice identity, its tax id opened for this invoice only;
 * the read recorded against the customer first (docs/04): no record, no read.
 */
async function profileOf(container: Container, order: OrderRow, invoiceId: string) {
  const profile = order.customer?.billing_profile
  if (!profile || !order.customer_id) {
    return null
  }
  await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
    kind: "sensitive_read",
    action: "einvoice.tax_id_sent",
    actor_type: "system",
    actor_id: null,
    resource_type: "customer",
    resource_id: order.customer_id,
    outcome: 200,
    changes: { invoice: invoiceId },
  })
  const taxId = await container
    .resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    .revealTaxId(profile.id, order.customer_id)
  return taxId
    ? {
        type: profile.type,
        legal_name: profile.legal_name,
        tax_office: profile.tax_office,
        tax_id: taxId,
      }
    : null
}

/**
 * The invoice an order asks for now (adr/0034 §3): its lines, its buyer,
 * how it was paid, and the carrier of its parcel once it left. Personal
 * data: read when the program needs it, never handed to a workflow.
 */
export async function invoiceDraftFor(
  container: Container,
  invoice: { id: string; order_id: string }
): Promise<DraftResult> {
  const { data } = await query(container).graph({
    entity: "order",
    fields: [
      ...LINE_FIELDS,
      "display_id",
      "created_at",
      "email",
      "customer_id",
      ...ADDRESS.map((field) => `billing_address.${field}`),
      ...ADDRESS.map((field) => `shipping_address.${field}`),
      "payment_collections.payments.provider_id",
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.created_at",
      "fulfillments.provider_id",
      "fulfillments.shipped_at",
      "fulfillments.canceled_at",
      "customer.billing_profile.id",
      "customer.billing_profile.type",
      "customer.billing_profile.legal_name",
      "customer.billing_profile.tax_office",
    ],
    filters: { id: invoice.order_id },
  })
  const order = data[0] as OrderRow | undefined
  if (!order) {
    return { problems: ["einvoice.no_lines"] }
  }
  const settings = await settingsOf(container)
  const parcel = (order.fulfillments ?? [])
    .filter((row) => row?.shipped_at && !row.canceled_at)
    .sort(
      (a, b) => new Date(b?.shipped_at ?? 0).getTime() - new Date(a?.shipped_at ?? 0).getTime()
    )[0]
  const shipment = parcel?.shipped_at
    ? {
        carrier: settings.carriers[carrierOf(parcel.provider_id) ?? "manual"] ?? null,
        shipped_at: new Date(parcel.shipped_at),
      }
    : null
  const profile = await profileOf(container, order, invoice.id)
  return invoiceDraft(order, profile, { store_url: settings.store_url, shipment })
}
