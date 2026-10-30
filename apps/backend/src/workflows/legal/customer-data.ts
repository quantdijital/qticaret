import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { BACK_IN_STOCK_MODULE } from "../../modules/back-in-stock"
import type BackInStockModuleService from "../../modules/back-in-stock/service"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { PRODUCT_QA_MODULE } from "../../modules/product-qa"
import type ProductQaModuleService from "../../modules/product-qa/service"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import type WishlistModuleService from "../../modules/wishlist/service"

type Container = Pick<MedusaContainer, "resolve">

const ADDRESS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
  "phone",
]

const iso = (value: unknown): string | null =>
  value instanceof Date || typeof value === "string" ? new Date(value).toISOString() : null

/**
 * Everything the shop keeps of one customer (F13.5, adr/0041 §6), as the
 * answer to their request for a copy: their profile and addresses, invoice
 * identity (the tax number's last four digits), orders, consents and the
 * contracts' acceptance, messages sent, returns, reviews, questions, stock
 * alerts and saved products. Sections are named in Turkish: the file is
 * theirs to read.
 */
export async function customerData(container: Container, customerId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "company_name",
      "phone",
      "has_account",
      "created_at",
      ...ADDRESS.map((field) => `addresses.${field}`),
      "billing_profile.type",
      "billing_profile.legal_name",
      "billing_profile.tax_office",
      "billing_profile.tax_id_kind",
      "billing_profile.tax_id_last4",
    ],
    filters: { id: customerId },
  })
  const customer = customers[0] as
    | (Record<string, unknown> & {
        addresses?: unknown[]
        billing_profile?: Record<string, unknown> | null
      })
    | undefined
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "customers.unknown")
  }
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "status",
      "email",
      "currency_code",
      "total",
      "items.title",
      "items.variant_title",
      "items.quantity",
      "items.total",
      ...ADDRESS.map((field) => `shipping_address.${field}`),
      ...ADDRESS.map((field) => `billing_address.${field}`),
    ],
    filters: { customer_id: customerId },
  })
  const orderIds = (orders as { id: string }[]).map((order) => order.id)
  const legal = container.resolve<LegalModuleService>(LEGAL_MODULE)
  const byCustomer = { customer_id: customerId }
  const [consents, legalConsents, returns, reviews, questions, alerts, saved, sent, legacy] =
    await Promise.all([
      container.resolve<MessagingModuleService>(MESSAGING_MODULE).listMessageConsents(byCustomer, {
        select: ["channel", "status", "recipient_masked", "updated_at"],
      }),
      orderIds.length ? legal.listLegalConsents({ order_id: orderIds }) : [],
      container
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .listReturnRequests(byCustomer, {
          select: ["order_id", "kind", "status", "reason", "note", "created_at"],
        }),
      container
        .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
        .listProductReviews(byCustomer, {
          select: ["product_id", "rating", "title", "body", "status", "created_at"],
        }),
      container
        .resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
        .listProductQuestions(byCustomer, {
          select: ["product_id", "body", "status", "created_at"],
        }),
      container
        .resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
        .listStockAlerts(byCustomer, {
          select: ["product_id", "variant_id", "email_masked", "status", "created_at"],
        }),
      container
        .resolve<WishlistModuleService>(WISHLIST_MODULE)
        .listWishlistItems(byCustomer, { select: ["product_id", "variant_id", "created_at"] }),
      query
        .graph({
          entity: "notification",
          fields: ["to", "channel", "template", "status", "created_at"],
          filters: { receiver_id: customerId },
        })
        .then(({ data }) => data as Record<string, unknown>[]),
      // Theirs by the account, and by their address (a guest's on the old platform)
      container
        .resolve<MigrationModuleService>(MIGRATION_MODULE)
        .listLegacyOrders(
          typeof customer["email"] === "string" && customer["email"] !== ""
            ? { $or: [byCustomer, { email: customer["email"].trim().toLowerCase() }] }
            : byCustomer,
          { select: ["number", "placed_at", "currency_code", "total", "status", "email", "lines"] }
        ),
    ])
  const { addresses, billing_profile: billing, ...profile } = customer
  return {
    hazırlanma: new Date().toISOString(),
    müşteri: profile,
    adresler: addresses ?? [],
    fatura_bilgisi: billing ?? null,
    siparişler: orders,
    önceki_platform_siparişleri: legacy.map((order) => ({ ...order, lines: order.lines["lines"] })),
    ileti_izinleri: consents,
    sözleşme_onayları: legalConsents.map((consent) => ({
      sipariş: consent.order_id,
      onay_zamanı: iso(consent.given_at),
      ip_adresi: legal.ipOf(consent),
      belgeler: consent.documents,
    })),
    iade_talepleri: returns,
    yorumlar: reviews,
    sorular: questions,
    stok_bildirimleri: alerts,
    favoriler: saved,
    gönderilen_iletiler: sent,
  }
}
