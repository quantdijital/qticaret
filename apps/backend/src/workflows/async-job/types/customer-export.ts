import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { z } from "@medusajs/framework/zod"
import { readCustomerStats } from "../../../api/admin/customer-stats/read"
import { AdminPostCustomerExport } from "../../../api/admin/customer-export/validators"
import {
  CUSTOMER_EXPORT_HEADER,
  CUSTOMER_EXPORT_WIDTHS,
  customerExportRow,
} from "../../../lib/customers/export-rows"
import type { ExportCustomer } from "../../../lib/customers/export-rows"
import { turkishDay } from "../../../lib/dashboard"
import { CSV_BOM, toCsv } from "../../../lib/security"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import type { SheetCell } from "../../../lib/sheets"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import type { JobType } from "./types"

type Input = z.infer<typeof AdminPostCustomerExport>

/** The most customers one file holds; past it the newest, and the summary says so. */
export const MAX_EXPORT_CUSTOMERS = 50_000
const PAGE = 1000
// The customer totals' own batch (`MAX_STATS_CUSTOMERS`)
const TOTALS_BATCH = 100

// Only what the list shows (adr/0011): no phone, address or tax id
const FIELDS = [
  "id",
  "first_name",
  "last_name",
  "company_name",
  "email",
  "has_account",
  "created_at",
]

/** The list's customers as its filters leave them (search, members or guests), newest first. */
async function exportedCustomers(
  container: MedusaContainer,
  input: Pick<Input, "q" | "kind">
): Promise<{ customers: ExportCustomer[]; capped: boolean }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const filters = {
    ...(input.q ? { q: input.q } : {}),
    ...(input.kind === "all" ? {} : { has_account: input.kind === "registered" }),
  }
  const customers: ExportCustomer[] = []
  let count = 0
  for (let skip = 0; skip < MAX_EXPORT_CUSTOMERS; skip += PAGE) {
    const { data, metadata } = await query.graph({
      entity: "customer",
      fields: FIELDS,
      filters,
      pagination: { skip, take: PAGE, order: { created_at: "DESC", id: "DESC" } },
    })
    customers.push(...(data as ExportCustomer[]))
    count = metadata?.count ?? customers.length
    if (data.length < PAGE || customers.length >= count) {
      break
    }
  }
  return { customers, capped: count > customers.length }
}

/**
 * The customer list as a file (CU2, the owner's alone): the customers its
 * search and tab leave, newest first, with the list's own columns and
 * numbers (`lib/customers/export-rows`). An xlsx, or a CSV (`;`, BOM,
 * decimal comma for Turkish Excel); every text cell escaped against
 * formulas (docs/04). Every customer's name and e-mail is in it: queued by
 * its own route, seen and downloaded by an owner alone, its making recorded
 * as a read of personal data and each download too (adr/0011).
 */
export const customerExport: JobType<Input> = {
  input: AdminPostCustomerExport,
  singleton: false,
  resultTtlDays: 7,
  containsPersonalData: true,
  ownerOnly: true,
  internal: true,
  execute: async ({ container, job, progress, resultFile }, input) => {
    const { format, ...filters } = input
    const { customers, capped } = await exportedCustomers(container, filters)
    await progress(10)
    const rows: SheetCell[][] = [[...CUSTOMER_EXPORT_HEADER]]
    let ordersCapped = false
    for (let start = 0; start < customers.length; start += TOTALS_BATCH) {
      const batch = customers.slice(start, start + TOTALS_BATCH)
      const totals = await readCustomerStats(
        container,
        batch.map((customer) => customer.id)
      )
      ordersCapped ||= totals.capped
      const byId = new Map(totals.stats.map((each) => [each.customer_id, each]))
      rows.push(...batch.map((customer) => customerExportRow(customer, byId.get(customer.id))))
      await progress(
        10 + Math.round((80 * Math.min(start + TOTALS_BATCH, customers.length)) / customers.length)
      )
    }
    const file = await resultFile(
      `musteriler-${turkishDay(new Date())}-${randomUUID().slice(0, 8)}.${format}`,
      format === "xlsx" ? XLSX_MIME : "text/csv"
    )
    if (format === "xlsx") {
      for await (const chunk of writeXlsx([
        { name: "Müşteriler", widths: CUSTOMER_EXPORT_WIDTHS, rows },
      ])) {
        await file.write(chunk as Buffer)
      }
    } else {
      await file.write(CSV_BOM)
      // Turkish Excel reads `1.5` as a date: numbers go out with a decimal comma
      await file.write(toCsv(rows, ";", { decimalComma: true }))
    }
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "sensitive_read",
      action: "customer.export_made",
      actor_type: "user",
      actor_id: job.requested_by ?? null,
      resource_type: "customer",
      resource_id: null,
      outcome: 200,
      // A search may be a person's name or e-mail: the record says one was made, not what
      changes: {
        filters: { kind: filters.kind, q_length: filters.q?.length ?? 0 },
        format,
        customers: customers.length,
        capped,
        job: job.id,
      },
    })
    await progress(100)
    return {
      summary: { customers: customers.length, format, capped, orders_capped: ordersCapped },
    }
  },
}
