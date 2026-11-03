import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import yazl from "yazl"
import {
  PACKAGE_SHEETS,
  PACKAGE_TABLES,
  giftCardSplit,
  packageTables,
} from "../../../lib/accounting"
import type { GiftCardOrder, PackageMove, PackageOrder, Party } from "../../../lib/accounting"
import { turkishDay, turkishDayStart } from "../../../lib/dashboard"
import { paidInTestMode } from "../../../lib/payments/test-mode"
import { CSV_BOM, toCsv } from "../../../lib/security"
import { writeXlsx } from "../../../lib/sheets"
import type { SheetCell } from "../../../lib/sheets"
import { ordersBetween } from "../../../api/admin/dashboard/orders"
import { MAX_REPORT_ORDERS } from "../../../api/admin/dashboard/overview/read"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { BILLING_PROFILE_MODULE } from "../../../modules/billing-profile"
import type BillingProfileModuleService from "../../../modules/billing-profile/service"
import { giftLineIdsOf } from "../../gift-cards/gift-marks"
import { paymentsMovedBetween } from "../../payments/moved-payments"
import type { MovedAmount, MovedPayment } from "../../payments/moved-payments"
import type { JobType } from "./types"

// As far back as a package is made; a month not yet begun is no month
const OLDEST_MONTHS = 24
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

const monthStart = (year: number, month: number) =>
  turkishDayStart(`${String(year)}-${String(month).padStart(2, "0")}-01`)

const input = z
  .object({ month: z.string().regex(MONTH, "accounting.month_invalid") })
  .strict()
  .superRefine(({ month }, ctx) => {
    const [year = 0, number = 0] = month.split("-").map(Number)
    const index = year * 12 + number - 1
    const today = turkishDay(new Date())
    const [nowYear = 0, nowMonth = 0] = today.split("-").map(Number)
    const now = nowYear * 12 + nowMonth - 1
    if (index > now || index < now - OLDEST_MONTHS) {
      ctx.addIssue({ code: "custom", path: ["month"], message: "accounting.month_invalid" })
    }
  })

// The finance report's fields, with what the package names an order by
const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "customer_id",
  "status",
  "currency_code",
  "total",
  "version",
  // Gift cards sold (an advance, out of the sales) and spent (adr/0025, 2026-11-03)
  "items.id",
  "items.product_id",
  "items.metadata",
  "credit_lines.reference",
  "credit_lines.raw_amount",
  "credit_lines.version",
  "items.total",
  "items.tax_total",
  "items.tax_lines.rate",
  "shipping_methods.total",
  "shipping_methods.tax_total",
  "shipping_methods.tax_lines.rate",
  "payment_collections.payments.data",
]

interface CustomerRow {
  id: string
  billing_profile?: {
    id: string
    type: string
    legal_name: string
    tax_office: string | null
    tax_id_kind: string
  } | null
}

/** Who each customer's invoices are for; a corporate's tax id read for the accountant. */
async function partiesOf(container: MedusaContainer, customerIds: string[]) {
  const parties = new Map<string, Party>()
  if (customerIds.length === 0) {
    return parties
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: [
      "id",
      "billing_profile.id",
      "billing_profile.type",
      "billing_profile.legal_name",
      "billing_profile.tax_office",
      "billing_profile.tax_id_kind",
    ],
    filters: { id: customerIds },
  })
  const profiles = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
  for (const customer of data as unknown as CustomerRow[]) {
    const profile = customer.billing_profile
    if (profile?.type !== "corporate" || profile.tax_id_kind !== "vkn") {
      continue
    }
    parties.set(customer.id, {
      kind: "corporate",
      name: profile.legal_name,
      tax_office: profile.tax_office,
      tax_id: await profiles.revealTaxId(profile.id, customer.id),
    })
  }
  return parties
}

/** The window's captures and refunds of live payments (a test payment moved no money). */
function movesOf(payments: readonly MovedPayment[], from: Date, to: Date) {
  const within = (moves: (MovedAmount | null)[] | null, payment: MovedPayment): PackageMove[] =>
    (moves ?? []).flatMap((move) => {
      const at = move ? new Date(move.created_at) : null
      return move && at && at >= from && at < to
        ? [
            {
              order_display_id: payment.payment_collection?.order?.display_id ?? null,
              day: turkishDay(at),
              provider_id: payment.provider_id,
              amount: move.amount,
            },
          ]
        : []
    })
  const live = payments.filter((payment) => payment.data?.["test_mode"] !== true)
  return {
    captures: live.flatMap((payment) => within(payment.captures, payment)),
    refunds: live.flatMap((payment) => within(payment.refunds, payment)),
  }
}

// Turkish Excel reads `1.5` as a date: numbers go out with a decimal comma
const csvOf = (rows: SheetCell[][]) =>
  Buffer.from(CSV_BOM + toCsv(rows, ";", { decimalComma: true }), "utf8")

/**
 * The month's standard accounting package (F11.5, adr/0039 §5): one zip
 * with an xlsx (a sheet per table) and the same tables as CSV, of the
 * month's sold orders (canceled and test ones left out), its refunds and
 * collections, the VAT summary, and the gift cards sold (an advance,
 * taken out of the sales) and spent. Corporate customers' tax ids are read
 * for it, so making one is recorded and downloading it is a personal data
 * read (adr/0011).
 */
export const accountingPackage: JobType<z.infer<typeof input>> = {
  input,
  singleton: false,
  resultTtlDays: 7,
  containsPersonalData: true,
  execute: async ({ container, job, progress, resultFile }, { month }) => {
    const [year = 0, number = 0] = month.split("-").map(Number)
    const from = monthStart(year, number)
    const to = number === 12 ? monthStart(year + 1, 1) : monthStart(year, number + 1)
    if (!from || !to) {
      throw new Error("accounting.month_invalid")
    }
    const page = await ordersBetween<
      PackageOrder & GiftCardOrder & { status: string; currency_code: string }
    >(container, ORDER_FIELDS, from, to, MAX_REPORT_ORDERS)
    const orders = page.rows.filter(
      (order) =>
        order.status !== "canceled" &&
        order.currency_code === "try" &&
        // The payments' data is read for this alone; the finance shape leaves it out
        !paidInTestMode(order as unknown as Parameters<typeof paidInTestMode>[0])
    )
    await progress(30)
    const parties = await partiesOf(container, [
      ...new Set(orders.flatMap((order) => (order.customer_id ? [order.customer_id] : []))),
    ])
    const { captures, refunds } = movesOf(await paymentsMovedBetween(container, from, to), from, to)
    const dayOf = (at: string | Date) => turkishDay(new Date(at))
    const gifts = await giftLineIdsOf(
      container,
      orders.flatMap((order) => order.items ?? []) as { id: string }[]
    )
    const split = orders.map((order) => giftCardSplit(order, gifts, dayOf))
    const tables = packageTables({
      orders: split.map((each) => each.order),
      parties,
      captures,
      refunds,
      giftCards: split.flatMap((each) => each.moves),
      dayOf,
    })
    await progress(70)

    const name = `muhasebe-paketi-${month}`
    const zip = new yazl.ZipFile()
    zip.addReadStream(
      writeXlsx(
        PACKAGE_TABLES.map((table) => ({
          name: PACKAGE_SHEETS[table].name,
          widths: PACKAGE_SHEETS[table].widths,
          rows: tables[table],
        }))
      ),
      `${name}.xlsx`
    )
    for (const table of PACKAGE_TABLES) {
      zip.addBuffer(csvOf(tables[table]), `${PACKAGE_SHEETS[table].file}-${month}.csv`)
    }
    zip.end()
    const file = await resultFile(`${name}-${randomUUID().slice(0, 8)}.zip`, "application/zip")
    for await (const chunk of zip.outputStream) {
      await file.write(chunk)
    }
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      // Corporate customers' tax ids were read for it: whose, by customer id
      kind: "sensitive_read",
      action: "accounting.package_made",
      actor_type: "user",
      actor_id: job.requested_by ?? null,
      resource_type: "accounting_package",
      resource_id: month,
      outcome: 200,
      changes: {
        month,
        orders: orders.length,
        corporate: parties.size,
        customers: [...parties.keys()],
        job: job.id,
      },
    })
    await progress(100)
    return {
      summary: {
        month,
        orders: orders.length,
        corporate: parties.size,
        capped: page.count > page.rows.length,
      },
    }
  },
}
