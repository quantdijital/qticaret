import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { addKurus, kurus } from "../../lib/money"
import { orderAccessKey } from "../../lib/orders/access-token"
import { linkEnd } from "../../lib/payment-links/snapshot"
import { newPaymentLinkToken, paymentLinkTokenHash } from "../../lib/payment-links/token"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import type { PaymentLinkAddress, PaymentLinkContact } from "../../modules/payment-links/service"
import { planPaymentLink } from "./plan"
import type { LinkPlan, PlanInput } from "./plan"
import { createLinkPromotion } from "./promotion"
import { quoteShipping } from "./shipping-quote"
import type { ShippingQuoteInput } from "./shipping-quote"

type Container = Pick<MedusaContainer, "resolve">

export interface CreatePaymentLinkInput extends PlanInput {
  /** A customer without an account: who staff are talking to. */
  guest: PaymentLinkContact | null
  address: PaymentLinkAddress | null
  note: string | null
  hours: number
}

interface LinkPromotion {
  id: string
  code: string
}

const service = (container: Container) =>
  container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)

/** The customer's contact from their record, when the link is for one. */
async function contactOf(
  container: Container,
  input: CreatePaymentLinkInput
): Promise<PaymentLinkContact> {
  if (!input.customer_id) {
    if (!input.guest) {
      throw new ValidationError("payment_link.customer_required", { field: "guest" })
    }
    return input.guest
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["email", "first_name", "last_name", "phone"],
    filters: { id: input.customer_id },
  })
  const row = data[0] as
    | {
        email?: string | null
        first_name?: string | null
        last_name?: string | null
        phone?: string | null
      }
    | undefined
  if (!row?.email) {
    throw new ValidationError("payment_link.customer_no_email", { field: "customer_id" })
  }
  return {
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    email: row.email,
    phone: row.phone ?? null,
  }
}

const planStep = createStep(
  "payment-links-plan",
  async (input: PlanInput, { container }) =>
    new StepResponse(await planPaymentLink(container, input))
)

/** The link's hidden promotion, when it has a discount; undone by removing it. */
const createPromotionStep = createStep(
  "payment-links-create-promotion",
  async (plan: LinkPlan, { container }) => {
    if (!plan.discount) {
      return new StepResponse<LinkPromotion | null, string | null>(null, null)
    }
    const made = await createLinkPromotion(container, plan.discount)
    return new StepResponse<LinkPromotion | null, string | null>(made, made.id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve(Modules.PROMOTION).deletePromotions([id])
    }
  }
)

/**
 * The link itself: its token made here and kept only as a hash and a seal,
 * so no run's record holds it; the contact sealed. Undone by removing it.
 */
const createLinkStep = createStep(
  "payment-links-create",
  async (
    input: {
      input: CreatePaymentLinkInput
      plan: LinkPlan
      promotion: { id: string; code: string } | null
    },
    { container }
  ) => {
    const links = service(container)
    const contact = await contactOf(container, input.input)
    const now = new Date()
    const { token, ends_at } = newPaymentLinkToken(orderAccessKey(), now)
    const link = await links.createPaymentLinks({
      status: "open",
      token_hash: paymentLinkTokenHash(token),
      token_sealed: links.sealToken(token),
      token_ends_at: ends_at,
      expires_at: linkEnd(input.input.hours, now),
      created_by: input.input.actor_id,
      customer_id: input.input.customer_id,
      sealed: links.sealPrivate({ contact, address: input.input.address }),
      email_hash: links.emailHashOf(contact.email),
      lines: input.plan.lines as unknown as Record<string, unknown>,
      discount: input.plan.discount as unknown as Record<string, unknown> | null,
      promotion_id: input.promotion?.id ?? null,
      promotion_code: input.promotion?.code ?? null,
      shipping_option_id: input.input.shipping_option_id,
      note: input.input.note,
      currency_code: "try",
      items_total: input.plan.items_total,
      discount_total: input.plan.discount?.amount ?? 0,
    })
    return new StepResponse({ id: link.id }, link.id)
  },
  async (id, { container }) => {
    if (id) {
      await service(container).deletePaymentLinks([id])
    }
  }
)

/**
 * A payment link (adr/0051 §1–§3): priced by the catalog now, its
 * discount a hidden single-use promotion within the role's limit, then
 * the record. Each step takes back its own when a later one fails.
 */
export const createPaymentLinkWorkflow = createWorkflow(
  "payment-links-create",
  (input: CreatePaymentLinkInput) => {
    const plan = planStep(
      transform({ input }, ({ input }) => ({
        actor_id: input.actor_id,
        customer_id: input.customer_id,
        lines: input.lines,
        discount: input.discount,
        shipping_option_id: input.shipping_option_id,
      }))
    )
    const promotion = createPromotionStep(plan)
    return new WorkflowResponse(createLinkStep({ input, plan, promotion }))
  }
)

export interface PreviewPaymentLinkInput extends PlanInput {
  /** Whether the form carries a delivery address (the address itself stays out of the run). */
  with_address: boolean
}

const quoteShippingStep = createStep(
  "payment-links-quote-shipping",
  async (input: ShippingQuoteInput, { container }) =>
    new StepResponse(await quoteShipping(container, input))
)

/**
 * "Önizle": the totals the backend works out, nothing written (adr/0051
 * §2): the lines, the discount, the preset option's shipping for the
 * address when Medusa can price it without a cart, and the total with it.
 */
export const previewPaymentLinkWorkflow = createWorkflow(
  "payment-links-preview",
  (input: PreviewPaymentLinkInput) => {
    const plan = planStep(
      transform({ input }, ({ input }) => ({
        actor_id: input.actor_id,
        customer_id: input.customer_id,
        lines: input.lines,
        discount: input.discount,
        shipping_option_id: input.shipping_option_id,
      }))
    )
    const shipping = quoteShippingStep(
      transform({ input, plan }, ({ input, plan }) => ({
        shipping_option_id: input.shipping_option_id,
        with_address: input.with_address,
        region_id: plan.region_id,
        item_total: plan.total,
      }))
    )
    return new WorkflowResponse(
      transform({ plan, shipping }, ({ plan, shipping }) => ({
        ...plan,
        ...shipping,
        total: addKurus(kurus(plan.total), kurus(shipping.shipping_total ?? 0)),
      }))
    )
  }
)
