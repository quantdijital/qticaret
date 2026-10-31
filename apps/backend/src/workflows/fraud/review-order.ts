import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { isDisposableEmail } from "../../lib/fraud/disposable"
import { scoreOrder } from "../../lib/fraud/score"
import type { OrderFacts, Score } from "../../lib/fraud/score"
import { CART_SIGNALS } from "../../lib/fraud/velocity"
import type { CartSignals } from "../../lib/fraud/velocity"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { FRAUD_GUARD_MODULE } from "../../modules/fraud-guard"
import type FraudGuardModuleService from "../../modules/fraud-guard/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SecuritySettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

interface OrderRow {
  email?: string | null
  customer_id?: string | null
  total: MedusaAmount
  shipping_address?: { province?: string | null } | null
  billing_address?: { province?: string | null } | null
  cart?: { metadata?: Record<string, unknown> | null } | null
  payment_collections?:
    ({ payment_sessions?: ({ status?: string | null } | null)[] | null } | null)[] | null
}

const count = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0)

/** What the score reads of a placed order, its buyer and its checkout. */
async function factsOf(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string,
  highAmount: number
): Promise<OrderFacts | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "email",
      "customer_id",
      "total",
      "shipping_address.province",
      "billing_address.province",
      "cart.metadata",
      "payment_collections.payment_sessions.status",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as OrderRow | undefined
  if (!order) {
    return null
  }
  // The buyer's orders: by account, else by address (a guest)
  const { data: earlier } = await query.graph({
    entity: "order",
    fields: ["id"],
    filters: order.customer_id ? { customer_id: order.customer_id } : { email: order.email ?? "" },
    pagination: { take: 2 },
  })
  const signals = (order.cart?.metadata?.[CART_SIGNALS] ?? {}) as Partial<CartSignals>
  const failed = (order.payment_collections ?? [])
    .flatMap((collection) => collection?.payment_sessions ?? [])
    .filter((session) => session?.status === "error").length
  return {
    firstOrder: earlier.length <= 1,
    total: fromMedusaAmount(order.total, { allowRounding: true }),
    highAmount,
    shippingProvince: order.shipping_address?.province ?? null,
    billingProvince: order.billing_address?.province ?? null,
    ipEmails: count(signals.ip_emails),
    phoneEmails: count(signals.phone_emails),
    disposableEmail: order.email ? isDisposableEmail(order.email) : false,
    failedPayments: failed,
  }
}

interface Reviewed extends Score {
  /** The review this run opened; null when the order did not reach the threshold, or had one. */
  review_id: string | null
}

/**
 * Scores a placed order (F15.6, adr/0044 §3) and, at the shop's threshold,
 * holds it for a person: the review is opened once per order. Undone by
 * removing the review it opened.
 */
const reviewOrderStep = createStep(
  "fraud-review-order",
  async (input: { order_id: string }, { container }) => {
    const settings = (await container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("security")) as unknown as SecuritySettings
    const facts = await factsOf(container, input.order_id, settings.fraud_high_amount)
    if (!facts) {
      return new StepResponse<Reviewed, string | null>(
        { score: 0, reasons: [], review_id: null },
        null
      )
    }
    const scored = scoreOrder(facts)
    if (scored.score < settings.fraud_review_score) {
      return new StepResponse<Reviewed, string | null>({ ...scored, review_id: null }, null)
    }
    const { id, opened } = await container
      .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
      .openReview(input.order_id, scored.score, scored.reasons)
    const review = opened ? id : null
    return new StepResponse<Reviewed, string | null>({ ...scored, review_id: review }, review)
  },
  async (reviewId, { container }) => {
    if (!reviewId) {
      return
    }
    await container
      .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
      .deleteFraudReviews(reviewId)
  }
)

export const reviewOrderWorkflow = createWorkflow(
  "fraud-review-order",
  (input: { order_id: string }) => new WorkflowResponse(reviewOrderStep(input))
)
