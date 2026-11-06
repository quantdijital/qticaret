import { randomUUID } from "node:crypto"
import type { z } from "@medusajs/framework/zod"
import { turkishDay } from "../../../lib/dashboard"
import { ORDER_EXPORT_HEADER, ORDER_EXPORT_WIDTHS } from "../../../lib/orders/export-rows"
import { CSV_BOM, toCsv } from "../../../lib/security"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import type { SheetCell } from "../../../lib/sheets"
import { AdminPostOrderExport } from "../../../api/admin/order-board/export/validators"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { EXPORT_BATCH, exportBatch, exportedIds } from "./order-export-read"
import type { JobType } from "./types"

type Input = z.infer<typeof AdminPostOrderExport>

/**
 * The order list as a file (owner only): the orders its filters leave, the
 * newest first, up to the list's own read (MAX_ORDERS_READ; `capped` says
 * when there were more), one row per order line (`lib/orders/export-rows`).
 * An xlsx, or a CSV (`;`, BOM, decimal comma for Turkish Excel). Every text
 * cell is escaped against formulas (docs/04). It holds every customer's
 * name, address and phone: queued by its own route, seen and downloaded by
 * an owner alone, its making recorded as a read of personal data and each
 * download too (adr/0011).
 */
export const orderExport: JobType<Input> = {
  input: AdminPostOrderExport,
  singleton: false,
  resultTtlDays: 7,
  containsPersonalData: true,
  ownerOnly: true,
  internal: true,
  execute: async ({ container, job, progress, resultFile }, query) => {
    const { format, ...filters } = query
    const { ids, limited } = await exportedIds(container, filters)
    await progress(10)
    const rows: SheetCell[][] = [[...ORDER_EXPORT_HEADER]]
    for (let start = 0; start < ids.length; start += EXPORT_BATCH) {
      rows.push(...(await exportBatch(container, ids.slice(start, start + EXPORT_BATCH))))
      await progress(
        10 + Math.round((80 * Math.min(start + EXPORT_BATCH, ids.length)) / ids.length)
      )
    }
    const file = await resultFile(
      `siparisler-${turkishDay(new Date())}-${randomUUID().slice(0, 8)}.${format}`,
      format === "xlsx" ? XLSX_MIME : "text/csv"
    )
    if (format === "xlsx") {
      for await (const chunk of writeXlsx([
        { name: "Siparişler", widths: ORDER_EXPORT_WIDTHS, rows },
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
      action: "order.export_made",
      actor_type: "user",
      actor_id: job.requested_by ?? null,
      resource_type: "order",
      resource_id: null,
      outcome: 200,
      changes: { filters, format, orders: ids.length, capped: limited, job: job.id },
    })
    await progress(100)
    return { summary: { orders: ids.length, lines: rows.length - 1, format, capped: limited } }
  },
}
