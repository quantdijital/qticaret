import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NOT_SALES, TOTALS_CURRENCY } from "../../../../lib/customers/totals"
import { customersReport } from "../../../../lib/customers/report"
import type {
  CustomersReport,
  NewCustomerRow,
  SaleRow,
  TopCustomer,
} from "../../../../lib/customers/report"
import { MAX_REPORT_ORDERS, windowOf } from "../../dashboard/overview/read"
import type { ReportRange } from "../../dashboard/overview/read"
import { ordersBetween } from "../../dashboard/orders"

const PAGE = 1000
// New customers read per report; past this the counts cover the first and say so
const MAX_NEW_CUSTOMERS = 50_000
// Buyers asked about at once whether they bought before the period
const BUYER_BATCH = 500

async function pagedRows(
  scope: MedusaContainer,
  entity: string,
  fields: string[],
  filters: Record<string, unknown>,
  max: number
): Promise<{ rows: unknown[]; capped: boolean }> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const rows: unknown[] = []
  let count = 0
  for (let skip = 0; skip < max; skip += PAGE) {
    const { data, metadata } = await query.graph({
      entity,
      fields,
      filters,
      pagination: { skip, take: PAGE, order: { created_at: "ASC", id: "ASC" } },
    })
    rows.push(...(data as unknown[]))
    count = metadata?.count ?? rows.length
    if (data.length < PAGE || rows.length >= count) {
      break
    }
  }
  return { rows, capped: count > rows.length }
}

/** The buyers among `ids` who had a sale before `before`. */
async function boughtBefore(
  scope: MedusaContainer,
  ids: readonly string[],
  before: Date
): Promise<Set<string>> {
  const found = new Set<string>()
  for (let start = 0; start < ids.length; start += BUYER_BATCH) {
    const batch = ids.slice(start, start + BUYER_BATCH)
    const { rows } = await pagedRows(
      scope,
      "order",
      ["customer_id", "created_at"],
      {
        customer_id: batch,
        created_at: { $lt: before },
        status: { $nin: [...NOT_SALES] },
        is_draft_order: false,
        currency_code: TOTALS_CURRENCY,
      },
      MAX_REPORT_ORDERS
    )
    for (const row of rows as { customer_id?: string | null }[]) {
      if (row.customer_id) {
        found.add(row.customer_id)
      }
    }
  }
  return found
}

export interface TopCustomerRow extends TopCustomer {
  /** The name the list shows: first and last, else the company, else the e-mail. */
  name: string | null
}

export type CustomersReportAnswer = Omit<CustomersReport, "top"> & {
  top: TopCustomerRow[]
  period: { granularity: "hour" | "day"; from: string; to: string }
  currency_code: string
  capped: boolean
}

/** The top customers' names as the customer list shows them; nothing else of theirs. */
async function namesOf(scope: MedusaContainer, ids: readonly string[]) {
  if (ids.length === 0) {
    return new Map<string, string | null>()
  }
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "first_name", "last_name", "company_name", "email"],
    filters: { id: [...ids] },
  })
  const rows = data as {
    id: string
    first_name?: string | null
    last_name?: string | null
    company_name?: string | null
    email?: string | null
  }[]
  return new Map(
    rows.map((row) => {
      const name = [row.first_name, row.last_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ")
      const company = row.company_name?.trim() ?? ""
      return [row.id, name !== "" ? name : company !== "" ? company : (row.email ?? null)]
    })
  )
}

/**
 * The customers report (R1) over a preset period or the days asked for:
 * new customers by bucket against the period before, buyers and how many
 * had bought before, and the ten who spent most, by name.
 */
export async function readCustomersReport(
  scope: MedusaContainer,
  range: ReportRange
): Promise<CustomersReportAnswer> {
  const window = windowOf(range)
  const [joined, sales] = await Promise.all([
    pagedRows(
      scope,
      "customer",
      ["id", "created_at", "has_account"],
      { created_at: { $gte: window.previousFrom, $lt: window.to } },
      MAX_NEW_CUSTOMERS
    ),
    ordersBetween<SaleRow>(
      scope,
      ["customer_id", "status", "currency_code", "total", "created_at"],
      window.from,
      window.to,
      MAX_REPORT_ORDERS
    ),
  ])
  const buyerIds = [
    ...new Set(sales.rows.flatMap((sale) => (sale.customer_id ? [sale.customer_id] : []))),
  ]
  const report = customersReport(
    window,
    joined.rows as NewCustomerRow[],
    sales.rows,
    await boughtBefore(scope, buyerIds, window.from)
  )
  const names = await namesOf(
    scope,
    report.top.map((row) => row.customer_id)
  )
  return {
    ...report,
    top: report.top.map((row) => ({ ...row, name: names.get(row.customer_id) ?? null })),
    period: {
      granularity: window.granularity,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
    },
    currency_code: TOTALS_CURRENCY,
    capped: joined.capped || sales.count > sales.rows.length,
  }
}
