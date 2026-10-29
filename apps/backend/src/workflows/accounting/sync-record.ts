import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { accountingAdapterOf } from "../../lib/accounting"
import type { AccountingAdapterId, MoneyInput, Party, SaleInput } from "../../lib/accounting"
import { turkishDay } from "../../lib/dashboard"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount, sumKurus, toMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { methodOf, vatBreakdown } from "../../lib/reports/finance"
import type { FinanceOrder } from "../../lib/reports/finance"
import { BILLING_PROFILE_MODULE } from "../../modules/billing-profile"
import type BillingProfileModuleService from "../../modules/billing-profile/service"
import type { SyncSource } from "../../modules/accounting/service"

type Sale = Omit<SaleInput, "reference" | "customer"> & { party: Party; customer_id: string | null }
type Money = Omit<MoneyInput, "reference">
type Source = { kind: "sale"; sale: Sale } | { kind: "payment" | "refund"; money: Money }

interface OrderRow extends FinanceOrder {
  display_id: number
  created_at: string | Date
  customer_id: string | null
  customer?: {
    billing_profile?: {
      id: string
      type: string
      legal_name: string
      tax_office: string | null
      tax_id_kind: string
    } | null
  } | null
}

async function saleOf(container: MedusaContainer, orderId: string): Promise<Source> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "customer_id",
      "total",
      "items.total",
      "items.tax_total",
      "items.tax_lines.rate",
      "shipping_methods.total",
      "shipping_methods.tax_total",
      "shipping_methods.tax_lines.rate",
      "customer.billing_profile.id",
      "customer.billing_profile.type",
      "customer.billing_profile.legal_name",
      "customer.billing_profile.tax_office",
      "customer.billing_profile.tax_id_kind",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as unknown as OrderRow | undefined
  if (!order) {
    throw new ValidationError("accounting.source_missing")
  }
  const lines = vatBreakdown([order])
  const profile = order.customer?.billing_profile
  const party: Party =
    profile?.type === "corporate" && profile.tax_id_kind === "vkn" && order.customer_id
      ? {
          kind: "corporate",
          name: profile.legal_name,
          tax_office: profile.tax_office,
          tax_id: await container
            .resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
            .revealTaxId(profile.id, order.customer_id),
        }
      : { kind: "individual" }
  return {
    kind: "sale",
    sale: {
      order_display_id: order.display_id,
      day: turkishDay(new Date(order.created_at)),
      lines,
      total: toMedusaAmount(sumKurus(lines.map((line) => fromMedusaAmount(line.gross)))),
      party,
      customer_id: order.customer_id,
    },
  }
}

async function moneyOf(
  container: MedusaContainer,
  kind: "payment" | "refund",
  id: string
): Promise<Source> {
  const payments = container.resolve(Modules.PAYMENT)
  const [move] =
    kind === "payment"
      ? await payments.listCaptures({ id }, { relations: ["payment"], take: 1 })
      : await payments.listRefunds({ id }, { relations: ["payment"], take: 1 })
  const paymentId = (move as { payment?: { id?: string } | null } | undefined)?.payment?.id
  if (!move || !paymentId) {
    throw new ValidationError("accounting.source_missing")
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: [
      "provider_id",
      `${kind === "payment" ? "captures" : "refunds"}.id`,
      `${kind === "payment" ? "captures" : "refunds"}.amount`,
      `${kind === "payment" ? "captures" : "refunds"}.created_at`,
      "payment_collection.order.display_id",
    ],
    filters: { id: paymentId },
  })
  const payment = data[0] as unknown as
    | {
        provider_id: string
        captures?: { id: string; amount: MedusaAmount; created_at: string | Date }[]
        refunds?: { id: string; amount: MedusaAmount; created_at: string | Date }[]
        payment_collection?: { order?: { display_id: number } | null } | null
      }
    | undefined
  const row = (kind === "payment" ? payment?.captures : payment?.refunds)?.find(
    (entry) => entry.id === id
  )
  if (!payment || !row) {
    throw new ValidationError("accounting.source_missing")
  }
  return {
    kind,
    money: {
      order_display_id: payment.payment_collection?.order?.display_id ?? null,
      day: turkishDay(new Date(row.created_at)),
      method: methodOf(payment.provider_id),
      amount: toMedusaAmount(fromMedusaAmount(row.amount, { allowRounding: true })),
    },
  }
}

/** What the program is sent for a record: read now, so it says what the shop has now. */
const readSourceStep = createStep(
  "accounting-read-source",
  async (input: { source_type: SyncSource; source_id: string }, { container }) =>
    new StepResponse(
      input.source_type === "sale"
        ? await saleOf(container, input.source_id)
        : await moneyOf(container, input.source_type, input.source_id)
    )
)

/**
 * Sends the record to the program under our record's id. No compensation:
 * it is the workflow's last step, so nothing after it can undo it, and a
 * record sent again (its answer lost) is the same record to the program,
 * which dedupes on the reference (KK2).
 */
const pushRecordStep = createStep(
  "accounting-push-record",
  async (input: { adapter: AccountingAdapterId; reference: string; source: Source }) => {
    const adapter = accountingAdapterOf(input.adapter)
    if (!adapter) {
      throw new ValidationError("accounting.adapter_unavailable")
    }
    const { source, reference } = input
    if (source.kind === "sale") {
      const { party, customer_id, ...sale } = source.sale
      const customer =
        party.kind === "corporate"
          ? await adapter.upsertCustomer({ reference: `customer:${customer_id ?? ""}`, party })
          : null
      return new StepResponse(await adapter.pushSale({ ...sale, reference, customer }))
    }
    const money = { ...source.money, reference }
    return new StepResponse(
      await (source.kind === "payment" ? adapter.pushPayment(money) : adapter.pushReturn(money))
    )
  }
)

/** One record to the shop's accounting program (F11.5, adr/0039 §5); its id in the program. */
export const syncAccountingRecordWorkflow = createWorkflow(
  "accounting-sync-record",
  (
    input: WorkflowData<{
      adapter: AccountingAdapterId
      sync_id: string
      source_type: SyncSource
      source_id: string
    }>
  ) => {
    const source = readSourceStep({ source_type: input.source_type, source_id: input.source_id })
    const ref = pushRecordStep({ adapter: input.adapter, reference: input.sync_id, source })
    return new WorkflowResponse(ref)
  }
)
