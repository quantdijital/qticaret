import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NOT_ORDERS } from "../../api/admin/dashboard/orders"
import { SHIPMENT_TRACKING_MODULE } from "../../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../modules/shipment-tracking/service"

type Container = Pick<MedusaContainer, "resolve">

// A few of each: the menu points the way, the lists hold the rest
const EACH = 5

export interface OrderHit {
  id: string
  display_id: number
  name: string | null
  total: number | string
  currency_code: string
}

export interface CustomerHit {
  id: string
  name: string | null
  email: string
}

export interface ProductHit {
  id: string
  title: string
  /** The variant's SKU the search matched, when it was one. */
  sku: string | null
}

export interface ParcelHit {
  order_id: string
  display_id: number | null
  tracking_number: string
  provider: string
}

interface OrderRow {
  id: string
  display_id: number | string
  total: number | string
  currency_code: string
  shipping_address?: { first_name?: string | null; last_name?: string | null } | null
}

const fullName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(" ").trim() || null

// Medusa's filter types do not know `q`; the modules take it as their free-text search
const textOf = (q: string): Record<string, unknown> => ({ q })

/** `#1024` and `1024` both ask for order 1024 first. */
const orderNumberOf = (q: string): number | null => {
  const digits = /^#?(\d{1,9})$/.exec(q)?.[1]
  return digits ? Number(digits) : null
}

async function orders(container: Container, q: string): Promise<OrderHit[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fields = [
    "id",
    "display_id",
    "total",
    "currency_code",
    "shipping_address.first_name",
    "shipping_address.last_name",
  ]
  const base = { status: { $nin: NOT_ORDERS }, is_draft_order: false }
  const number = orderNumberOf(q)
  // Medusa's filter types take display_id as text; the column is a number
  const byNumber: Record<string, unknown> = { display_id: number }
  const byText = textOf(number === null ? q : String(number))
  const [exact, matched] = await Promise.all([
    number === null
      ? { data: [] }
      : query.graph({ entity: "order", fields, filters: { ...base, ...byNumber } }),
    query.graph({
      entity: "order",
      fields,
      filters: { ...base, ...byText },
      pagination: { take: EACH, order: { created_at: "DESC" } },
    }),
  ])
  const rows = [...(exact.data as OrderRow[]), ...(matched.data as OrderRow[])]
  return [...new Map(rows.map((row) => [row.id, row])).values()].slice(0, EACH).map((row) => ({
    id: row.id,
    display_id: Number(row.display_id),
    name: fullName(row.shipping_address?.first_name, row.shipping_address?.last_name),
    total: row.total,
    currency_code: row.currency_code,
  }))
}

async function customers(container: Container, q: string): Promise<CustomerHit[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name", "company_name"],
    filters: textOf(q),
    pagination: { take: EACH, order: { created_at: "DESC" } },
  })
  return (
    data as {
      id: string
      email: string
      first_name?: string | null
      last_name?: string | null
      company_name?: string | null
    }[]
  ).map((row) => ({
    id: row.id,
    name: fullName(row.first_name, row.last_name) ?? row.company_name ?? null,
    email: row.email,
  }))
}

async function products(container: Container, q: string): Promise<ProductHit[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [bySku, byText] = await Promise.all([
    query.graph({
      entity: "product_variant",
      fields: ["sku", "product.id", "product.title"],
      filters: { sku: { $ilike: `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` } },
      pagination: { take: EACH },
    }),
    query.graph({
      entity: "product",
      fields: ["id", "title"],
      filters: textOf(q),
      pagination: { take: EACH, order: { updated_at: "DESC" } },
    }),
  ])
  const hits = new Map<string, ProductHit>()
  for (const row of bySku.data as {
    sku?: string | null
    product?: { id: string; title: string } | null
  }[]) {
    if (row.product && !hits.has(row.product.id)) {
      hits.set(row.product.id, {
        id: row.product.id,
        title: row.product.title,
        sku: row.sku ?? null,
      })
    }
  }
  for (const row of byText.data as { id: string; title: string }[]) {
    if (!hits.has(row.id)) {
      hits.set(row.id, { id: row.id, title: row.title, sku: null })
    }
  }
  return [...hits.values()].slice(0, EACH)
}

async function parcels(container: Container, q: string): Promise<ParcelHit[]> {
  // A tracking number is letters and digits; anything else is not one
  if (!/^[A-Za-z0-9-]{6,40}$/.test(q)) {
    return []
  }
  const shipments = await container
    .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
    .listTrackedShipments(
      { tracking_number: [...new Set([q, q.toUpperCase()])] },
      { take: EACH, select: ["order_id", "tracking_number", "provider"] }
    )
  if (shipments.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: shipments.map((row) => row.order_id) },
  })
  const numbers = new Map(
    (data as { id: string; display_id: number | string }[]).map((row) => [
      row.id,
      Number(row.display_id),
    ])
  )
  return shipments.map((row) => ({
    order_id: row.order_id,
    display_id: numbers.get(row.order_id) ?? null,
    tracking_number: row.tracking_number ?? "",
    provider: row.provider,
  }))
}

/**
 * The panel's search (F12.9): orders by number, e-mail or address, the
 * order's own number first; customers by name, e-mail or phone; products
 * by name or SKU; parcels by tracking number. A few of each.
 */
export async function globalSearch(container: Container, q: string) {
  const [orderHits, customerHits, productHits, parcelHits] = await Promise.all([
    orders(container, q),
    customers(container, q),
    products(container, q),
    parcels(container, q),
  ])
  return {
    orders: orderHits,
    customers: customerHits,
    products: productHits,
    parcels: parcelHits,
  }
}
