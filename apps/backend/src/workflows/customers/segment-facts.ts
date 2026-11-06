import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { createStep } from "@medusajs/framework/workflows-sdk"
import { needsOrders } from "../../lib/customers/segments"
import type { CustomerFacts, SegmentRules } from "../../lib/customers/segments"
import { logger } from "../../lib/logging"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"

// What a segment's rules are checked against: every customer, their sales and consent

const PAGE = 1000
// A daily job's bound: past it the segment covers what was read, and the log says so
const MAX_ROWS = 200_000
// Not sales: drafts, archived and canceled orders
const NOT_SALES = ["draft", "archived", "canceled"]

type Container = Parameters<Parameters<typeof createStep>[1]>[1]["container"]

async function readAll<T>(
  container: Container,
  entity: string,
  fields: string[],
  filters: Record<string, unknown>
): Promise<T[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const rows: T[] = []
  for (let skip = 0; skip < MAX_ROWS; skip += PAGE) {
    const { data } = await query.graph({
      entity,
      fields,
      filters,
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    rows.push(...(data as T[]))
    if (data.length < PAGE) {
      return rows
    }
  }
  logger.warn({ event: "customer_segments.read_capped", entity, max: MAX_ROWS })
  return rows
}

/** Each customer's facts the rules read; orders and consent only when a rule needs them. */
export async function customerFacts(
  container: Container,
  rules: SegmentRules
): Promise<CustomerFacts[]> {
  const customers = await readAll<{ id: string; has_account: boolean }>(
    container,
    "customer",
    ["id", "has_account", "created_at"],
    {}
  )
  const facts = new Map<string, CustomerFacts>(
    customers.map((customer) => [
      customer.id,
      {
        id: customer.id,
        hasAccount: customer.has_account,
        spent: 0,
        orders: 0,
        lastOrderAt: null,
        emailConsent: false,
      },
    ])
  )
  if (needsOrders(rules)) {
    const orders = await readAll<{
      customer_id: string | null
      created_at: string | Date
      payment_collections?:
        | ({
            captured_amount?: MedusaAmount | null
            refunded_amount?: MedusaAmount | null
          } | null)[]
        | null
    }>(
      container,
      "order",
      [
        "customer_id",
        "created_at",
        "payment_collections.captured_amount",
        "payment_collections.refunded_amount",
      ],
      { status: { $nin: NOT_SALES }, is_draft_order: false }
    )
    const lira = (amount: MedusaAmount | null | undefined) =>
      amount ? fromMedusaAmount(amount, { allowRounding: true }) : 0
    for (const order of orders) {
      const entry = order.customer_id ? facts.get(order.customer_id) : undefined
      // A sale is money taken and kept: an order unpaid yet (cash at the door, a bank
      // transfer awaited) puts no one in a group with its prices (security review 2026-10-29)
      const kept = (order.payment_collections ?? []).reduce(
        (sum, collection) =>
          sum + lira(collection?.captured_amount) - lira(collection?.refunded_amount),
        0
      )
      if (!entry || kept <= 0) {
        continue
      }
      entry.orders += 1
      entry.spent += kept
      const at = new Date(order.created_at)
      if (!entry.lastOrderAt || at > entry.lastOrderAt) {
        entry.lastOrderAt = at
      }
    }
  }
  if (rules.email_consent !== undefined) {
    const consents = await container
      .resolve<MessagingModuleService>(MESSAGING_MODULE)
      .listMessageConsents({ channel: "email", status: "granted" }, { select: ["customer_id"] })
    for (const consent of consents) {
      const entry = consent.customer_id ? facts.get(consent.customer_id) : undefined
      if (entry) {
        entry.emailConsent = true
      }
    }
  }
  return [...facts.values()]
}
