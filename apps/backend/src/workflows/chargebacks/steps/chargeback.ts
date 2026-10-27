import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { fromMedusaAmount, kurus, sumKurus } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { isHostedFormProvider, providerName } from "../../../lib/payments/checkout"
import { CHARGEBACKS_MODULE } from "../../../modules/chargebacks"
import type ChargebacksModuleService from "../../../modules/chargebacks/service"
import { NEXT_STATUS, OPEN_STATUSES, isClosed } from "../../../modules/chargebacks/states"
import type { ChargebackReason, ChargebackStatus } from "../../../modules/chargebacks/states"

export interface OpenChargebackInput {
  order_id: string
  /** Kuruş the cardholder disputes; at most what the payment took. */
  amount: number
  reason: ChargebackReason
  provider_reference?: string | null
  due_at?: string | null
  note?: string | null
  created_by?: string | null
}

interface PaymentRow {
  id: string
  provider_id: string
  currency_code: string
  canceled_at?: unknown
  captures?: ({ raw_amount?: MedusaAmount; amount?: MedusaAmount } | null)[] | null
}

const sumOf = (rows: PaymentRow["captures"]) =>
  sumKurus(
    (rows ?? []).map((row) =>
      fromMedusaAmount(row?.raw_amount ?? row?.amount ?? 0, { allowRounding: true })
    )
  )

/**
 * The order's captured card payment the dispute is against (adr/0030): one
 * a hosted form took (a bank transfer or cash is not disputed with a card
 * issuer), not cancelled, with no dispute still open on it, disputing no
 * more than it took.
 */
export const readDisputedPaymentStep = createStep(
  "chargebacks-read-disputed-payment",
  async (input: OpenChargebackInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.payments.id",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.currency_code",
        "payment_collections.payments.canceled_at",
        "payment_collections.payments.captures.amount",
        "payment_collections.payments.captures.raw_amount",
      ],
      filters: { id: input.order_id },
    })
    const order = data[0] as
      | { payment_collections?: ({ payments?: (PaymentRow | null)[] | null } | null)[] | null }
      | undefined
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
    }
    const payment = (order.payment_collections ?? [])
      .flatMap((collection) => collection?.payments ?? [])
      .find((each): each is PaymentRow =>
        Boolean(
          each &&
          isHostedFormProvider(each.provider_id) &&
          !each.canceled_at &&
          sumOf(each.captures) > 0
        )
      )
    if (!payment) {
      throw new ValidationError("chargebacks.order_unpaid")
    }
    if (sumOf(payment.captures) < kurus(input.amount)) {
      throw new ValidationError("chargebacks.amount_exceeds_paid", { field: "amount" })
    }
    const [open] = await container
      .resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
      .listChargebacks({ payment_id: payment.id, status: [...OPEN_STATUSES] }, { take: 1 })
    if (open) {
      throw new ValidationError("chargebacks.already_open")
    }
    return new StepResponse({
      payment_id: payment.id,
      provider: providerName(payment.provider_id),
      currency_code: payment.currency_code,
    })
  }
)

export const createChargebackStep = createStep(
  "chargebacks-create",
  async (
    input: OpenChargebackInput & { payment_id: string; provider: string; currency_code: string },
    { container }
  ) => {
    const created = await container
      .resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
      .createChargebacks({
        order_id: input.order_id,
        payment_id: input.payment_id,
        provider: input.provider,
        provider_reference: input.provider_reference ?? null,
        amount: input.amount,
        currency_code: input.currency_code,
        reason: input.reason,
        due_at: input.due_at ? new Date(input.due_at) : null,
        note: input.note ?? null,
        created_by: input.created_by ?? null,
      })
    return new StepResponse(created, created.id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE).deleteChargebacks(id)
    }
  }
)

/**
 * Moves a dispute on (adr/0030): only forward, and a closed one never
 * again. The update holds only if the state is still the one read.
 */
export const moveChargebackStep = createStep(
  "chargebacks-move-status",
  async (input: { id: string; status: ChargebackStatus; note?: string | null }, { container }) => {
    const service = container.resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
    const [before] = await service.listChargebacks({ id: input.id }, { take: 1 })
    if (!before) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "chargebacks.unknown")
    }
    if (!NEXT_STATUS[before.status].includes(input.status)) {
      throw new ValidationError("chargebacks.transition_invalid", { field: "status" })
    }
    const [after] = await service.updateChargebacks({
      selector: { id: before.id, status: before.status },
      data: {
        status: input.status,
        ...(input.note === undefined ? {} : { note: input.note }),
        closed_at: isClosed(input.status) ? new Date() : null,
      },
    })
    if (!after) {
      throw new ConflictError("chargebacks.changed")
    }
    return new StepResponse(after, {
      id: before.id,
      status: before.status,
      note: before.note,
      closed_at: before.closed_at,
    })
  },
  async (previous, { container }) => {
    if (previous) {
      await container
        .resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
        .updateChargebacks(previous)
    }
  }
)
