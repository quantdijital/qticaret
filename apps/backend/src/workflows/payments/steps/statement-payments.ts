import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { turkishDay, turkishDayStart } from "../../../lib/dashboard"
import { ValidationError } from "../../../lib/errors"
import { fromMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import {
  IYZICO_PAYMENT_PROVIDER_ID,
  PAYTR_PAYMENT_PROVIDER_ID,
} from "../../../lib/payments/checkout"
import { aroundDay } from "../../../lib/payments/statements"
import type { ShopPayment, StatementProvider } from "../../../lib/payments/statements"
import { PAYMENT_RECOVERY_MODULE } from "../../../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../../modules/payment-recovery/service"

const PROVIDER_IDS: Readonly<Record<StatementProvider, string>> = {
  paytr: PAYTR_PAYMENT_PROVIDER_ID,
  iyzico: IYZICO_PAYMENT_PROVIDER_ID,
}

// Where each provider's reference sits in the payment's data
const REFERENCE_KEYS: Readonly<Record<StatementProvider, string>> = {
  paytr: "merchant_oid",
  iyzico: "payment_id",
}

const PAGE = 500
const DAY_MS = 24 * 60 * 60 * 1000

interface Moved {
  amount: MedusaAmount
  created_at: string | Date
}

interface PaymentRow {
  id: string
  provider_id: string
  data: Record<string, unknown> | null
  captures: (Moved | null)[] | null
  refunds: (Moved | null)[] | null
  payment_collection: { order?: { id: string; display_id: number } | null } | null
}

/** The ids of the payments that took or gave back money in the window, any provider. */
async function paymentsMovedBetween(container: MedusaContainer, from: Date, to: Date) {
  const payments = container.resolve(Modules.PAYMENT)
  const window = { created_at: { $gte: from.toISOString(), $lt: to.toISOString() } }
  const ids = new Set<string>()
  for (const list of [
    (skip: number) => payments.listCaptures(window, { relations: ["payment"], take: PAGE, skip }),
    (skip: number) => payments.listRefunds(window, { relations: ["payment"], take: PAGE, skip }),
  ]) {
    for (let skip = 0; ; skip += PAGE) {
      const rows = await list(skip)
      for (const row of rows as { payment?: { id?: string } | null }[]) {
        // Typed as always there; a row whose payment did not load is skipped, not trusted
        if (row.payment?.id) {
          ids.add(row.payment.id)
        }
      }
      if (rows.length < PAGE) {
        break
      }
    }
  }
  return [...ids]
}

const inWindow = (moved: (Moved | null)[] | null, from: Date, to: Date) =>
  (moved ?? [])
    .filter((entry): entry is Moved => entry !== null)
    .map((entry) => ({ at: new Date(entry.created_at), amount: entry.amount }))
    .filter(({ at }) => at >= from && at < to)
    .map(({ at, amount }) => ({
      amount: fromMedusaAmount(amount, { allowRounding: true }),
      day: turkishDay(at),
    }))

/**
 * The shop's side of a statement (F11.3): the provider's payments that
 * took or gave back money on the day or either side of it, in the
 * account's mode (a test payment moved no money), each with its order.
 * `known` names the statement's references that became no order and are
 * in the recovery records (adr/0026 §6).
 */
export const statementPaymentsStep = createStep(
  "payments-statement-payments",
  async (
    input: {
      provider: StatementProvider
      day: string
      test_mode: boolean
      references: string[]
      skip: boolean
    },
    { container }
  ) => {
    if (input.skip) {
      return new StepResponse({ payments: [] as ShopPayment[], known: [] as string[] })
    }
    const { before, after } = aroundDay(input.day)
    const from = turkishDayStart(before)
    const last = turkishDayStart(after)
    if (!from || !last) {
      throw new ValidationError("statements.day_invalid")
    }
    const to = new Date(last.getTime() + DAY_MS)
    const ids = await paymentsMovedBetween(container, from, to)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const rows: PaymentRow[] = []
    for (let start = 0; start < ids.length; start += PAGE) {
      const { data } = await query.graph({
        entity: "payment",
        fields: [
          "id",
          "provider_id",
          "data",
          "captures.amount",
          "captures.created_at",
          "refunds.amount",
          "refunds.created_at",
          "payment_collection.order.id",
          "payment_collection.order.display_id",
        ],
        filters: { id: ids.slice(start, start + PAGE) },
      })
      rows.push(...(data as unknown as PaymentRow[]))
    }
    const key = REFERENCE_KEYS[input.provider]
    const payments: ShopPayment[] = rows.flatMap((row) => {
      const reference = row.data?.[key]
      const testMode = row.data?.["test_mode"] === true
      if (
        row.provider_id !== PROVIDER_IDS[input.provider] ||
        typeof reference !== "string" ||
        testMode !== input.test_mode
      ) {
        return []
      }
      return [
        {
          reference,
          order: row.payment_collection?.order ?? null,
          captures: inWindow(row.captures, from, to),
          refunds: inWindow(row.refunds, from, to),
        },
      ]
    })
    const shopReferences = new Set(payments.map((payment) => payment.reference))
    const unknown = input.references.filter((reference) => !shopReferences.has(reference))
    const known =
      unknown.length === 0
        ? []
        : (
            await container
              .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
              .listPaymentRecoveries(
                { provider: input.provider, reference: unknown },
                { select: ["reference"] }
              )
          ).map((recovery) => recovery.reference)
    return new StepResponse({ payments, known })
  }
)
