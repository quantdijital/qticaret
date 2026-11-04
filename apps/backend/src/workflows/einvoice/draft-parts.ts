import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { parseEnv } from "../../lib/env"
import type { Env } from "../../lib/env"
import { EXCHANGE_FIELDS } from "../../lib/invoicing"
import type { ExchangedOrder, InvoiceExchange, InvoiceProfile } from "../../lib/invoicing"
import { carrierOf } from "../../lib/shipping/carriers"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { BILLING_PROFILE_MODULE } from "../../modules/billing-profile"
import type BillingProfileModuleService from "../../modules/billing-profile/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { CarrierIdentity, InvoicingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { storefrontUrlOf } from "../messaging/brand"

type Container = Pick<MedusaContainer, "resolve">

/** An order as its invoice draft reads it: its lines, its buyer's profile, its parcels. */
export type OrderRow = ExchangedOrder & {
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
        items?: ({ line_item_id?: string | null } | null)[] | null
      } | null)[]
    | null
}

/** The order's exchanges, each with the lines it added (adr/0032 §6). */
export async function exchangesOf(container: Container, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order_exchange",
    fields: EXCHANGE_FIELDS,
    filters: { order_id: orderId },
  })
  return data as InvoiceExchange[]
}

/**
 * The carriers as the shop named them, and the storefront's address: its
 * canonical host, else on a developer's machine the dev storefront, as a
 * message's links take it (`storefrontUrlOf`). Never a stand-in deployed:
 * a shop without a host gets `einvoice.store_url_missing`.
 */
export async function settingsOf(
  container: Container,
  env: Pick<Env, "NODE_ENV" | "STOREFRONT_ORIGIN"> = parseEnv()
) {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [invoicing, seo] = await Promise.all([
    settings.readSection("invoicing"),
    settings.readSection("seo"),
  ])
  const host = (seo.values as { canonical_host?: string | null }).canonical_host
  return {
    carriers: (invoicing.values as unknown as InvoicingSettings).carriers,
    store_url: storefrontUrlOf(host, env),
  }
}

/**
 * The buyer's invoice identity, its tax id opened for this invoice only;
 * the read recorded against the customer first (docs/04): no record, no read.
 */
export async function profileOf(container: Container, order: OrderRow, invoiceId: string) {
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

type CarrierIdentities = InvoicingSettings["carriers"]

/**
 * Who carries the order, for the e-Arşiv's internet sale details, which
 * are never left out (the owner, 2026-10-31):
 * - the parcel that left, on the day it left;
 * - before that, the carrier of the shipping option the buyer chose at
 *   checkout, dated the day the invoice is made (an invoice cut once the
 *   order is placed and paid, the default).
 * The carrier's name and tax id are the shop's, entered once (Settings >
 * E-Fatura); a carrier without them holds the invoice back. Null for an
 * order with nothing to ship. Only a parcel with the invoice's lines in
 * it counts: an exchange's parcel is its own sale's.
 */
export async function shipmentOf(
  container: Container,
  order: OrderRow,
  carriers: CarrierIdentities,
  now: Date,
  lines: ReadonlySet<string>
): Promise<{ carrier: CarrierIdentity | null; shipped_at: Date } | null> {
  const identity = (providerId: string | null | undefined) =>
    carriers[carrierOf(providerId) ?? "manual"] ?? null
  const parcel = (order.fulfillments ?? [])
    .filter((row) => row?.shipped_at && !row.canceled_at)
    .filter((row) => (row?.items ?? []).some((item) => lines.has(item?.line_item_id ?? "")))
    .sort(
      (a, b) => new Date(b?.shipped_at ?? 0).getTime() - new Date(a?.shipped_at ?? 0).getTime()
    )[0]
  if (parcel?.shipped_at) {
    return { carrier: identity(parcel.provider_id), shipped_at: new Date(parcel.shipped_at) }
  }
  const optionIds = (order.shipping_methods ?? []).flatMap((method) =>
    method?.shipping_option_id ? [method.shipping_option_id] : []
  )
  if (optionIds.length === 0) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: ["id", "provider_id"],
    filters: { id: optionIds },
  })
  const chosen = (data as { id: string; provider_id?: string | null }[]).find(
    (option) => option.id === optionIds[0]
  )
  return { carrier: identity(chosen?.provider_id), shipped_at: now }
}
