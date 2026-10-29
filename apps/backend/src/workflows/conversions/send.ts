import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { conversionsApi, ga4AccountOf, metaAccountOf } from "../../lib/conversions/client"
import { ga4Purchase, ga4Refund, metaPurchase } from "../../lib/conversions/events"
import type { ConversionOrder } from "../../lib/conversions/events"
import { isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { CONVERSIONS_MODULE } from "../../modules/conversions"
import type ConversionsModuleService from "../../modules/conversions/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What happened to each target's event: `sent`, `duplicate` (sent before),
 * `no_consent`, `not_connected`, or the provider's word for a failure.
 */
export type ConversionOutcome = string

/** Outcomes that leave nothing to send again. */
const SETTLED = new Set(["sent", "duplicate", "no_consent", "not_connected"])

interface OrderRow {
  id: string
  email: string | null
  created_at: string | Date
  total: MedusaAmount
  shipping_total: MedusaAmount
  shipping_address?: { phone?: string | null } | null
  cart?: { id: string } | null
  items?:
    | ({
        variant_id?: string | null
        product_title?: string | null
        title?: string | null
        unit_price: MedusaAmount
        quantity: MedusaAmount
      } | null)[]
    | null
}

const lira = (amount: MedusaAmount): number =>
  fromMedusaAmount(amount, { allowRounding: true }) / 100

async function orderOf(container: Container, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "email",
      "created_at",
      "total",
      "shipping_total",
      "shipping_address.phone",
      "cart.id",
      "items.variant_id",
      "items.product_title",
      "items.title",
      "items.unit_price",
      "items.quantity",
    ],
    filters: { id: orderId },
  })
  const row = data[0] as OrderRow | undefined
  if (!row) {
    return null
  }
  const order: ConversionOrder = {
    id: row.id,
    email: row.email,
    phone: row.shipping_address?.phone ?? null,
    createdAt: new Date(row.created_at),
    total: lira(row.total),
    shipping: lira(row.shipping_total),
    items: (row.items ?? []).flatMap((item) =>
      item
        ? [
            {
              id: item.variant_id ?? item.title ?? "",
              title: item.product_title ?? item.title ?? "",
              price: lira(item.unit_price),
              quantity: Number(item.quantity),
            },
          ]
        : []
    ),
  }
  return { order, cartId: row.cart?.id ?? null }
}

/** Sends one event once, recording what it came to; a failure is kept for the retry. */
async function attempt(
  container: Container,
  input: { key: string; target: string; kind: string; order_id: string; amount?: number | null },
  send: () => Promise<unknown>
): Promise<ConversionOutcome> {
  const conversions = container.resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
  if (!(await conversions.claimEvent(input))) {
    return "duplicate"
  }
  try {
    await send()
    await conversions.settleEvent(input.key, null)
    return "sent"
  } catch (error) {
    const code = isProviderError(error) ? error.providerCode : "failed"
    logger.warn({
      event: "conversions.send_failed",
      target: input.target,
      err: errorSummary(error),
    })
    await conversions.settleEvent(input.key, code)
    return code
  }
}

const accounts = async (container: Container) => {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const [meta, ga4] = await Promise.all([credentials.read("meta"), credentials.read("ga4")])
  return { meta: metaAccountOf(meta), ga4: ga4AccountOf(ga4) }
}

/**
 * An order's purchase, sent to the shop's Meta pixel and GA4 stream as
 * the shopper allowed at checkout (F10.9, adr/0038 §4; KK5): Meta only
 * with marketing consent, GA4 only with analytics consent and the
 * browser's GA4 id. No consent, nothing sent. Once both went, the
 * browser's IP and details are forgotten. Nothing to undo: an event sent
 * cannot be called back, and Meta counts its event id once.
 */
const sendPurchaseConversionsStep = createStep(
  "conversions-send-purchase",
  async (input: { order_id: string }, { container }) => {
    const found = await orderOf(container, input.order_id)
    if (!found) {
      return new StepResponse({ meta: "not_found", ga4: "not_found" })
    }
    const conversions = container.resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
    if (found.cartId) {
      await conversions.moveToOrder(found.cartId, found.order.id)
    }
    const consent = await conversions.ofOrder(found.order.id)
    const connected = await accounts(container)
    const api = conversionsApi()
    const base = { order_id: found.order.id, kind: "purchase" }
    const order = found.order
    let meta: ConversionOutcome = "no_consent"
    if (consent?.marketing) {
      const account = connected.meta
      meta = account
        ? await attempt(
            container,
            { ...base, key: `meta:purchase:${order.id}`, target: "meta" },
            () => api.sendMeta(account, [metaPurchase(order, consent.client)])
          )
        : "not_connected"
    }
    let ga4: ConversionOutcome = "no_consent"
    const clientId = consent?.analytics ? consent.gaClientId : null
    if (consent && clientId) {
      const account = connected.ga4
      ga4 = account
        ? await attempt(
            container,
            { ...base, key: `ga4:purchase:${order.id}`, target: "ga4" },
            () =>
              api.sendGa4(account, {
                clientId,
                adConsent: consent.marketing,
                events: [ga4Purchase(order)],
              })
          )
        : "not_connected"
    }
    // The browser's IP and details serve Meta alone: kept only while its event may be sent again
    if (SETTLED.has(meta)) {
      await conversions.forgetClients([order.id])
    }
    return new StepResponse({ meta, ga4 })
  }
)

export const sendPurchaseConversionsWorkflow = createWorkflow(
  "conversions-send-purchase",
  (input: { order_id: string }) => new WorkflowResponse(sendPurchaseConversionsStep(input))
)

/**
 * A refund of the order, told to GA4 against the same transaction, with
 * the analytics consent the purchase went with (F10.9). Meta has no
 * refund event: nothing goes there. `amount` in kuruş; none: the whole
 * order (a cancellation).
 */
const sendRefundConversionStep = createStep(
  "conversions-send-refund",
  async (input: { order_id: string; refund_id: string; amount: number | null }, { container }) => {
    const conversions = container.resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
    const consent = await conversions.ofOrder(input.order_id)
    const clientId = consent?.analytics ? consent.gaClientId : null
    if (!consent || !clientId) {
      return new StepResponse({ ga4: "no_consent" })
    }
    const { ga4 } = await accounts(container)
    if (!ga4) {
      return new StepResponse({ ga4: "not_connected" })
    }
    const value =
      input.amount === null
        ? ((await orderOf(container, input.order_id))?.order.total ?? 0)
        : input.amount / 100
    const outcome = await attempt(
      container,
      {
        key: `ga4:refund:${input.refund_id}`,
        target: "ga4",
        kind: "refund",
        order_id: input.order_id,
        amount: input.amount,
      },
      () =>
        conversionsApi().sendGa4(ga4, {
          clientId,
          adConsent: consent.marketing,
          events: [ga4Refund(input.order_id, value)],
        })
    )
    return new StepResponse({ ga4: outcome })
  }
)

export const sendRefundConversionWorkflow = createWorkflow(
  "conversions-send-refund",
  (input: { order_id: string; refund_id: string; amount: number | null }) =>
    new WorkflowResponse(sendRefundConversionStep(input))
)
