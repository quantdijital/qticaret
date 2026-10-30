import type { SourceAddress, SourceCustomer, SourceOrder, SourcePage } from "../types"
import type { BulkNode } from "./bulk"
import { amount, at, childrenOf, date, roots, text, typeOf } from "./fields"

/**
 * Shopify's customers, orders and content pages as the common records
 * (F14, adr/0042 §§4–5): Turkish addresses only, consent only as Shopify
 * dated it, old orders with their state in the shop's words.
 */

function addressOf(node: BulkNode): SourceAddress {
  return {
    first_name: text(node, "firstName"),
    last_name: text(node, "lastName"),
    company: text(node, "company"),
    address_1: text(node, "address1", 500),
    address_2: text(node, "address2", 500),
    city: text(node, "city"),
    province: text(node, "province"),
    postal_code: text(node, "zip", 20),
    phone: text(node, "phone", 32),
  }
}

/** A consent Shopify records as given, with its date; else none (adr/0042 §5). */
const consentAt = (node: BulkNode, state: string, updated: string): Date | null =>
  text(node, state) === "SUBSCRIBED" ? date(node, updated) : null

export function customersOf(nodes: readonly BulkNode[]): SourceCustomer[] {
  const children = childrenOf(nodes)
  return roots(nodes, "Customer").flatMap((node) => {
    if (!node.id) {
      return []
    }
    const email = consentAt(
      node,
      "defaultEmailAddress.marketingState",
      "defaultEmailAddress.marketingUpdatedAt"
    )
    const sms = consentAt(
      node,
      "defaultPhoneNumber.smsMarketingConsent.state",
      "defaultPhoneNumber.smsMarketingConsent.updatedAt"
    )
    return [
      {
        source_key: node.id,
        // None: left out as an address the platform cannot take
        email: text(node, "defaultEmailAddress.emailAddress", 320) ?? "",
        first_name: text(node, "firstName"),
        last_name: text(node, "lastName"),
        phone: text(node, "defaultPhoneNumber.phoneNumber", 32),
        // The platform keeps Turkish addresses only
        addresses: (children.get(node.id) ?? [])
          .filter((child) => typeOf(child) === "MailingAddress")
          .filter((child) => text(child, "countryCodeV2") === "TR")
          .map(addressOf)
          .slice(0, 20),
        marketing: email || sms ? { email, sms } : null,
        created_at: date(node, "createdAt"),
      },
    ]
  })
}

// How the customer's page names an old order's state
const FINANCIAL: Readonly<Record<string, string>> = {
  PAID: "Ödendi",
  PARTIALLY_PAID: "Kısmen ödendi",
  PENDING: "Ödeme bekleniyor",
  AUTHORIZED: "Ödeme onaylandı",
  REFUNDED: "İade edildi",
  PARTIALLY_REFUNDED: "Kısmen iade edildi",
  VOIDED: "İptal edildi",
  EXPIRED: "Süresi doldu",
}

function statusOf(node: BulkNode): string {
  if (text(node, "cancelledAt")) {
    return "İptal edildi"
  }
  if (text(node, "displayFulfillmentStatus") === "FULFILLED") {
    return "Gönderildi"
  }
  return FINANCIAL[text(node, "displayFinancialStatus") ?? ""] ?? "Tamamlandı"
}

export function ordersOf(nodes: readonly BulkNode[]): SourceOrder[] {
  const children = childrenOf(nodes)
  return roots(nodes, "Order").flatMap((node) => {
    const placed = date(node, "createdAt")
    const total = amount(node, "totalPriceSet.shopMoney.amount")
    const currency = text(node, "currencyCode", 3)?.toLowerCase()
    if (!node.id || !placed || total === null || !currency || !/^[a-z]{3}$/.test(currency)) {
      return []
    }
    return [
      {
        source_key: node.id,
        number: text(node, "name", 64) ?? node.id,
        created_at: placed,
        currency,
        total,
        status: statusOf(node),
        customer_email:
          text(node, "customer.defaultEmailAddress.emailAddress", 320) ?? text(node, "email", 320),
        lines: (children.get(node.id) ?? [])
          .filter((child) => typeOf(child) === "LineItem")
          .slice(0, 500)
          .map((child) => ({
            title: text(child, "title", 500) ?? "",
            sku: text(child, "sku"),
            quantity: Math.max(1, Math.trunc(Number(at(child, "quantity")) || 1)),
            total: amount(child, "discountedTotalSet.shopMoney.amount") ?? "0.00",
          })),
      },
    ]
  })
}

/** Content pages, blogs and their articles: their old addresses (F14.7). */
export function pagesOf(pages: readonly BulkNode[], blogs: readonly BulkNode[]): SourcePage[] {
  const path = (...parts: string[]) => `/${parts.map(encodeURIComponent).join("/")}`
  const handles = new Map<string, string>()
  const found: SourcePage[] = []
  for (const node of roots(pages, "Page")) {
    const handle = text(node, "handle")
    if (node.id && handle) {
      found.push({
        source_key: node.id,
        title: text(node, "title") ?? handle,
        old_url: path("pages", handle),
      })
    }
  }
  for (const node of roots(blogs, "Blog")) {
    const handle = text(node, "handle")
    if (node.id && handle) {
      handles.set(node.id, handle)
      found.push({
        source_key: node.id,
        title: text(node, "title") ?? handle,
        old_url: path("blogs", handle),
      })
    }
  }
  for (const node of blogs) {
    const blog = handles.get(node.__parentId ?? "")
    const handle = text(node, "handle")
    if (typeOf(node) === "Article" && node.id && blog && handle) {
      found.push({
        source_key: node.id,
        title: text(node, "title") ?? handle,
        old_url: path("blogs", blog, handle),
      })
    }
  }
  return found
}
