import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { PeriodWindow } from "../../../../lib/dashboard"
import { kurus, toMedusaAmount } from "../../../../lib/money"
import { stockRows, stockTotals } from "../../../../lib/reports/stock"
import type { StockItem, StockRow } from "../../../../lib/reports/stock"
import { STOCK_LEDGER_MODULE } from "../../../../modules/stock-ledger"
import type StockLedgerModuleService from "../../../../modules/stock-ledger/service"
import { ordersBetween } from "../../dashboard/orders"
import { MAX_REPORT_ORDERS, cached } from "../../dashboard/overview/read"

// Stock items read at most (docs/04); past this the report says `capped`
const MAX_ITEMS = 5_000
const PAGE = 1_000
// Days without a sale that make stock idle (adr/0039 §4)
export const IDLE_DAYS = 90
// Rows per list a person reads on the page; the file has them all
const LIST = 100
const DAY_MS = 24 * 60 * 60 * 1000

interface ItemRow {
  id: string
  sku: string | null
  title: string | null
  created_at: string | Date
  location_levels?: ({ stocked_quantity?: number | string | null } | null)[] | null
  variants?:
    | ({
        id: string
        title: string | null
        sku: string | null
        created_at: string | Date
        product?: { id: string; title: string } | null
        variant_extension?: { cost: number | null } | null
      } | null)[]
    | null
}

const ITEM_FIELDS = [
  "id",
  "sku",
  "title",
  "created_at",
  "location_levels.stocked_quantity",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.created_at",
  "variants.product.id",
  "variants.product.title",
  "variants.variant_extension.cost",
]

/** The shop's stock items with their variant, product and unit cost. */
async function stockItems(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const items: StockItem[] = []
  let count = 0
  for (let skip = 0; skip < MAX_ITEMS; skip += PAGE) {
    const { data, metadata } = await query.graph({
      entity: "inventory_item",
      fields: ITEM_FIELDS,
      pagination: { skip, take: PAGE, order: { created_at: "ASC", id: "ASC" } },
    })
    for (const row of data as unknown as ItemRow[]) {
      const variant = (row.variants ?? []).find((entry) => entry !== null) ?? null
      const cost = variant?.variant_extension?.cost ?? null
      items.push({
        item_id: row.id,
        variant_id: variant?.id ?? null,
        product_id: variant?.product?.id ?? null,
        product_title: variant?.product?.title ?? row.title,
        variant_title: variant?.title ?? null,
        sku: variant?.sku ?? row.sku,
        created_at: new Date(variant?.created_at ?? row.created_at),
        on_hand: (row.location_levels ?? []).reduce(
          (sum, level) => sum + Number(level?.stocked_quantity ?? 0),
          0
        ),
        cost: cost === null ? null : kurus(cost),
      })
    }
    count = metadata?.count ?? items.length
    if (data.length < PAGE || items.length >= count) {
      break
    }
  }
  return { items, capped: count > items.length }
}

/** Units sold per variant in `[from, to)`, canceled orders left out. */
async function soldBetween(scope: MedusaContainer, from: Date, to: Date) {
  const page = await ordersBetween<{
    status: string
    items?: ({ variant_id?: string | null; quantity?: number | string | null } | null)[] | null
  }>(scope, ["id", "status", "items.variant_id", "items.quantity"], from, to, MAX_REPORT_ORDERS)
  const units = new Map<string, number>()
  for (const order of page.rows.filter((row) => row.status !== "canceled")) {
    for (const item of order.items ?? []) {
      if (item?.variant_id) {
        units.set(item.variant_id, (units.get(item.variant_id) ?? 0) + Number(item.quantity ?? 0))
      }
    }
  }
  return { units, capped: page.count > page.rows.length }
}

/**
 * Every stock item's numbers over a window (F11.4, adr/0039 §4): on the
 * shelf, cost and value, sold, the stock at the window's two ends from the
 * stock ledger, turnover, idle or not.
 */
export async function computeStockRows(scope: MedusaContainer, window: PeriodWindow) {
  const now = new Date()
  const { items, capped } = await stockItems(scope)
  const ids = items.map((item) => item.item_id)
  const ledger = scope.resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
  // A window that runs to now ends with what is on the shelf now
  const endsNow = window.to.getTime() >= now.getTime() - 60_000
  const [sold, lately, start, end] = await Promise.all([
    soldBetween(scope, window.from, window.to),
    soldBetween(scope, new Date(now.getTime() - IDLE_DAYS * DAY_MS), now),
    ledger.stockedAt(ids, window.from),
    endsNow ? Promise.resolve(new Map<string, number>()) : ledger.stockedAt(ids, window.to),
  ])
  const rows = stockRows(
    items,
    { sold: sold.units, soldLately: new Set(lately.units.keys()), start, end },
    { idleDays: IDLE_DAYS, now }
  )
  return { rows, capped: capped || sold.capped || lately.capped }
}

const lira = (amount: number | null) => (amount === null ? null : toMedusaAmount(kurus(amount)))

/** A row as the panel and the file read it: amounts in lira. */
export const stockView = (row: StockRow) => ({
  item_id: row.item_id,
  variant_id: row.variant_id,
  product_id: row.product_id,
  product_title: row.product_title,
  variant_title: row.variant_title,
  sku: row.sku,
  on_hand: row.on_hand,
  cost: lira(row.cost),
  value: lira(row.value),
  sold: row.sold,
  start: row.start,
  end: row.end,
  turnover: row.turnover,
  idle: row.idle,
})

const byValue = (a: StockRow, b: StockRow) => (b.value ?? 0) - (a.value ?? 0)

/**
 * The stock report (F11.4): its totals and the lists a person reads, each
 * the first LIST rows: the most valuable stock, the slowest turning, the
 * idle, and what is on the shelf without a cost.
 */
export async function computeStockReport(scope: MedusaContainer, window: PeriodWindow) {
  const { rows, capped } = await computeStockRows(scope, window)
  const shelved = rows.filter((row) => row.on_hand > 0)
  const list = (picked: StockRow[]) => picked.slice(0, LIST).map(stockView)
  return {
    period: { key: window.key, from: window.from.toISOString(), to: window.to.toISOString() },
    currency_code: "try",
    capped,
    idle_days: IDLE_DAYS,
    totals: stockTotals(rows),
    value: list(shelved.filter((row) => row.value !== null).sort(byValue)),
    slow: list(
      shelved
        .filter((row) => row.turnover !== null)
        .sort((a, b) => (a.turnover ?? 0) - (b.turnover ?? 0) || b.on_hand - a.on_hand)
    ),
    idle: list(
      shelved.filter((row) => row.idle).sort((a, b) => byValue(a, b) || b.on_hand - a.on_hand)
    ),
    uncosted: list(
      shelved.filter((row) => row.value === null).sort((a, b) => b.on_hand - a.on_hand)
    ),
  }
}

export type StockReport = Awaited<ReturnType<typeof computeStockReport>>

const stock = cached(computeStockReport)

export const readStockReport = stock.read

/** Tests start from an empty cache. */
export const clearStockCache = stock.clear
