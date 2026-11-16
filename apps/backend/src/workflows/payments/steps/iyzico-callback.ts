import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { RetryableError } from "../../../lib/errors"
import { IYZICO_PAYMENT_PROVIDER_ID, PAYMENT_SESSION_ID } from "../../../lib/payments/checkout"
import { iyzicoApi, iyzicoCredentialsOf } from "../../../lib/payments/iyzico"
import type { CheckoutFormResult } from "../../../lib/payments/iyzico"
import { safeEqual } from "../../../lib/security"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import { PAYMENT_FORMS_MODULE } from "../../../modules/payment-forms"
import type PaymentFormsModuleService from "../../../modules/payment-forms/service"
import { iyzicoSession } from "../../../modules/payment-iyzico/session"
import { PAYMENT_RECOVERY_MODULE } from "../../../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../../modules/payment-recovery/service"
import { GIVEN_BACK } from "../../../modules/payment-recovery/service"
import type { RecoveryInput } from "../../../modules/payment-recovery/service"
import { placedOrderOfCart } from "../placed-order"
import type { PlacedOrder } from "../placed-order"
import type { PaymentVerdict } from "./payment-orphan"

export interface IyzicoForm {
  /** Our session: iyzico's conversation and basket. */
  session_id: string
  token: string
}

export type IyzicoTarget =
  | {
      session_id: string
      token: string
      cart_id: string
      orphan: false
      expected: { amount: number; currency_code: string; test_mode: boolean }
      return_urls: { success: string; failure: string }
    }
  // A session replaced while its form stayed payable (a token cannot be withdrawn)
  | { session_id: string; token: string; cart_id: null; orphan: true }

/** Our session behind a callback, when the token is the one it holds; null when not ours. */
export const findIyzicoSessionStep = createStep(
  "payments-find-iyzico-session",
  async (form: IyzicoForm, { container }) => {
    if (!PAYMENT_SESSION_ID.test(form.session_id)) {
      return new StepResponse<IyzicoTarget | null>(null)
    }
    const [session] = await container
      .resolve(Modules.PAYMENT)
      .listPaymentSessions(
        { id: form.session_id },
        { select: ["id", "provider_id", "payment_collection_id", "data"] }
      )
    // Medusa deletes a replaced session outright: iyzico's signed answer decides (basket = session)
    if (!session) {
      return new StepResponse<IyzicoTarget | null>({ ...form, cart_id: null, orphan: true })
    }
    if (session.provider_id !== IYZICO_PAYMENT_PROVIDER_ID) {
      return new StepResponse<IyzicoTarget | null>(null)
    }
    const stored = iyzicoSession(session.data)
    if (!safeEqual(stored.token, form.token)) {
      return new StepResponse<IyzicoTarget | null>(null)
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "payment_collection",
      fields: ["cart.id"],
      filters: { id: session.payment_collection_id },
    })
    const cartId = (data[0] as { cart?: { id: string } | null } | undefined)?.cart?.id
    return new StepResponse<IyzicoTarget | null>(
      cartId
        ? {
            ...form,
            cart_id: cartId,
            orphan: false,
            expected: {
              amount: stored.amount,
              currency_code: stored.currency_code,
              test_mode: stored.test_mode,
            },
            return_urls: stored.return_urls,
          }
        : null
    )
  }
)

/**
 * `paid`: the order can be placed. `review`: paid, held by iyzico's fraud
 * check. `unpaid`: nothing paid with the form. `failed`: a card refused, or
 * a payment iyzico's fraud check refused (iyzico gives it back itself).
 * `orphan`: paid, to be given back, never an order.
 */
export type IyzicoOutcome = "paid" | "review" | "unpaid" | "failed" | "orphan" | "not_ours"

export interface IyzicoCheck {
  outcome: IyzicoOutcome
  verdict: PaymentVerdict
  /** iyzico's payment, signed: the orphan's reference. */
  payment_id: string | null
  /** The order the session's payment already placed: answered without asking iyzico again. */
  order_id?: string
}

/**
 * A form whose payment the cart's order already holds (a refreshed page, a
 * re-posted callback, the reconcile job; finding 2026-11-16): handled, as
 * when it was paid, and nothing is judged or completed again. An order
 * that holds another session's payment is not this form's: it goes on to
 * iyzico's answer (and the shop is told, `complete-paid-cart.ts`).
 */
export function answeredBefore(
  target: IyzicoTarget,
  placed: PlacedOrder | null
): IyzicoCheck | null {
  if (target.orphan || !placed?.order_id || !placed.session_ids.includes(target.session_id)) {
    return null
  }
  return { outcome: "paid", verdict: { kind: "skip" }, payment_id: null, order_id: placed.order_id }
}

/**
 * What iyzico's signed result means for the session (adr/0026 §4): a
 * payment recorded to be given back stays that way (a later callback or the
 * job after the cart could complete again would make refund and goods).
 */
export function iyzicoVerdict(
  target: IyzicoTarget,
  result: CheckoutFormResult | null,
  testMode: boolean,
  recorded: { reason: RecoveryInput["reason"]; cart_id: string | null } | null
): IyzicoCheck {
  const skip = (outcome: IyzicoOutcome): IyzicoCheck => ({
    outcome,
    verdict: { kind: "skip" },
    payment_id: result?.paymentId ?? null,
  })
  if (!result) {
    return skip("unpaid")
  }
  // Signed by iyzico, yet for another basket: not this session's form
  if (result.basketId !== target.session_id) {
    return skip("not_ours")
  }
  if (!result.paid || result.fraudStatus === -1) {
    return skip("failed")
  }
  const taken = {
    amount: result.price ?? 0,
    currency_code: (result.currency ?? "").toLowerCase(),
    test_mode: testMode,
  }
  const orphan = (reason: RecoveryInput["reason"], cartId: string | null): IyzicoCheck => ({
    outcome: "orphan",
    verdict: { kind: "orphan", reason, ...taken, cart_id: cartId },
    payment_id: result.paymentId,
  })
  if (recorded) {
    return orphan(recorded.reason, recorded.cart_id)
  }
  if (target.orphan) {
    return orphan("session_gone", null)
  }
  const { expected } = target
  const matches =
    taken.amount === expected.amount &&
    taken.currency_code === expected.currency_code.toLowerCase() &&
    taken.test_mode === expected.test_mode &&
    result.paidPrice !== null &&
    result.paidPrice >= taken.amount
  if (!matches) {
    return orphan("amount_mismatch", target.cart_id)
  }
  // Held by iyzico's fraud check: the order waits for its approval (the reconcile job asks)
  if (result.fraudStatus !== 1) {
    return skip("review")
  }
  return {
    outcome: "paid",
    verdict: {
      kind: "complete",
      cart_id: target.cart_id,
      ...taken,
      provider: "iyzico",
      reference: result.paymentId ?? target.session_id,
      session_id: target.session_id,
    },
    payment_id: result.paymentId,
  }
}

/** The form's result from iyzico (signed), against what the session expected. */
export const checkIyzicoPaymentStep = createStep(
  "payments-check-iyzico-payment",
  async (target: IyzicoTarget | null, { container }) => {
    if (!target) {
      return new StepResponse<IyzicoCheck>({
        outcome: "not_ours",
        verdict: { kind: "skip" },
        payment_id: null,
      })
    }
    const before = target.orphan ? null : await placedOrderOfCart(container, target.cart_id)
    const answered = answeredBefore(target, before)
    if (answered) {
      return new StepResponse<IyzicoCheck>(answered)
    }
    const account = iyzicoCredentialsOf(
      await container
        .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
        .read("iyzico")
    )
    if (!account) {
      throw new RetryableError("iyzico.not_configured")
    }
    const result = await iyzicoApi().retrieveCheckoutForm(account, {
      conversationId: target.session_id,
      token: target.token,
    })
    const [recorded] = result?.paymentId
      ? await container
          .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
          .listPaymentRecoveries(
            { provider: "iyzico", reference: result.paymentId, status: [...GIVEN_BACK] },
            { take: 1 }
          )
      : []
    return new StepResponse(iyzicoVerdict(target, result, account.testMode, recorded ?? null))
  }
)

const FINAL: readonly IyzicoOutcome[] = ["paid", "orphan"]

/**
 * Closes the form's record once nothing more can come of it: paid, given
 * back, or lapsed unpaid. One under review, or with a refused card that
 * can still be tried again, stays open for the reconcile job.
 */
export const closePaymentFormStep = createStep(
  "payments-close-payment-form",
  async (input: { session_id: string; outcome: IyzicoOutcome }, { container }) => {
    const forms = container.resolve<PaymentFormsModuleService>(PAYMENT_FORMS_MODULE)
    if (FINAL.includes(input.outcome)) {
      await forms.close(input.session_id, input.outcome)
    } else if (input.outcome === "unpaid" || input.outcome === "failed") {
      const [form] = await forms.listPaymentForms(
        { session_id: input.session_id, status: "open" },
        { take: 1 }
      )
      if (form && form.expires_at.getTime() < Date.now()) {
        await forms.close(input.session_id, input.outcome)
      }
    }
    return new StepResponse(null)
  }
)
