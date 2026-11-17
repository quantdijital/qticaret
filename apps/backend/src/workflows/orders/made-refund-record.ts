import type { BigNumberInput, MedusaContainer, UpdatePaymentDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, Modules } from "@medusajs/framework/utils"
import { ConflictError } from "../../lib/errors"
import { kurus, toMedusaAmount } from "../../lib/money"
import { refundRecordOf, withRefundRecord } from "../../lib/payments/pending-refund"

type Raw = BigNumberInput | null | undefined

interface PaymentRow {
  id: string
  data?: Record<string, unknown> | null
  payment_collection_id: string
  captures?: ({ raw_amount?: Raw } | null)[] | null
  refunds?: ({ id: string; note?: string | null; raw_amount?: Raw } | null)[] | null
}

// The payment module's generated method: a refund record, no provider call
interface RefundRecords {
  createRefunds(data: {
    payment: string
    amount: BigNumberInput
    created_by?: string
    note?: string
  }): Promise<{ id: string }>
}

const sum = (rows: ({ raw_amount?: Raw } | null)[] | null | undefined) =>
  (rows ?? []).reduce((total, row) => MathBN.add(total, row?.raw_amount ?? 0), MathBN.convert(0))

/** The note that names, on Medusa's refund, the ledger refund it was written for. */
export const checkedNote = (reference: string) => `refund checked at the provider: ${reference}`

async function readPayment(
  container: Pick<MedusaContainer, "resolve">,
  paymentId: string
): Promise<PaymentRow | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: [
      "id",
      "data",
      "payment_collection_id",
      "captures.raw_amount",
      "refunds.id",
      "refunds.note",
      "refunds.raw_amount",
    ],
    filters: { id: paymentId },
  })
  return data[0] as PaymentRow | undefined
}

/**
 * The payment collection's refunded total, as Medusa's own refund keeps it
 * (2.21.2 `maybeUpdatePaymentCollection_`: the sum of its payments' refunds).
 */
async function updateRefundedTotal(
  container: Pick<MedusaContainer, "resolve">,
  collectionId: string
): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment_collection",
    fields: ["payments.refunds.raw_amount"],
    filters: { id: collectionId },
  })
  const collection = data[0] as { payments?: (PaymentRow | null)[] | null } | undefined
  const refunded = (collection?.payments ?? []).reduce(
    (total, payment) => MathBN.add(total, sum(payment?.refunds)),
    MathBN.convert(0)
  )
  await container
    .resolve(Modules.PAYMENT)
    .updatePaymentCollections(collectionId, { refunded_amount: refunded } as never)
}

/**
 * Medusa's record of a refund made outside its call (the provider's answer
 * lost, its refund deleted with the failure; review 2026-11-17, D-2): once,
 * never past what the payment took less what it gave back, an earlier try's
 * record (by its note and amount) reused; its id kept in the payment's data
 * as a provider records one, and the collection's refunded total kept.
 */
export async function recordMadeRefund(
  container: Pick<MedusaContainer, "resolve">,
  entry: { payment_id: string; reference: string; amount: number },
  actorId: string
): Promise<void> {
  const payment = await readPayment(container, entry.payment_id)
  if (!payment || refundRecordOf(payment.data, entry.reference, entry.amount)) {
    return
  }
  const amount = toMedusaAmount(kurus(entry.amount))
  const note = checkedNote(entry.reference)
  let refundId = (payment.refunds ?? []).find(
    (refund) => refund?.note === note && MathBN.eq(refund.raw_amount ?? 0, amount)
  )?.id
  if (!refundId) {
    const left = MathBN.sub(sum(payment.captures), sum(payment.refunds))
    if (MathBN.lt(left, amount)) {
      throw new ConflictError("orders.refund_exceeds_paid")
    }
    refundId = (
      await (container.resolve(Modules.PAYMENT) as unknown as RefundRecords).createRefunds({
        payment: payment.id,
        amount,
        created_by: actorId,
        note,
      })
    ).id
  }
  const data = withRefundRecord(payment.data ?? {}, entry.reference, kurus(entry.amount), refundId)
  await container.resolve(Modules.PAYMENT).updatePayment({
    id: payment.id,
    data: { refunds: data["refunds"] },
  } as unknown as UpdatePaymentDTO)
  await updateRefundedTotal(container, payment.payment_collection_id)
}
