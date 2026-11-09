import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { replayPaytrPayment } from "../jobs/paytr-reconcile"
import { logger } from "../lib/logging"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../lib/payments/checkout"
import { paytrCredentialsOf } from "../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../modules/integration-credentials/service"

interface CartRow {
  completed_at?: string | Date | null
  order?: { id: string; display_id?: number | null } | null
  payment_collection?: {
    payment_sessions?:
      ({ id: string; provider_id: string; data?: Record<string, unknown> | null } | null)[] | null
  } | null
}

/**
 * Usage: pnpm --filter @qticaret/backend medusa exec ./src/scripts/paytr-replay.ts <cart_id>
 *
 * A cart paid by PayTR that is still no order, past the reconcile job's
 * day (adr/0026 Ek 2026-11-06): PayTR is asked about each of the cart's
 * PayTR sessions, and a payment it shows goes through the notification's
 * own workflow, once (the same event key). Nothing is paid or refunded
 * here; a payment PayTR does not show is left alone.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const cartId = args[0] ?? ""
  if (!/^cart_[0-9A-Z]{20,40}$/.test(cartId)) {
    throw new Error("paytr-replay: give the cart's id, e.g. cart_01M6…")
  }
  const account = paytrCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("paytr")
  )
  if (!account) {
    throw new Error("paytr-replay: no PayTR account is connected")
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const read = async () =>
    (
      await query.graph({
        entity: "cart",
        fields: [
          "completed_at",
          "order.id",
          "order.display_id",
          "payment_collection.payment_sessions.id",
          "payment_collection.payment_sessions.provider_id",
          "payment_collection.payment_sessions.data",
        ],
        filters: { id: cartId },
      })
    ).data[0] as CartRow | undefined
  const cart = await read()
  if (!cart) {
    throw new Error(`paytr-replay: no cart ${cartId}`)
  }
  if (cart.order) {
    logger.info({ event: "paytr.replay_done_already", cartId, orderId: cart.order.id })
    return
  }
  const references = (cart.payment_collection?.payment_sessions ?? []).flatMap((session) =>
    session?.provider_id === PAYTR_PAYMENT_PROVIDER_ID &&
    typeof session.data?.["merchant_oid"] === "string"
      ? [session.data["merchant_oid"]]
      : []
  )
  for (const merchantOid of references) {
    const paid = await replayPaytrPayment(container, account, merchantOid)
    logger.info({ event: "paytr.replay", cartId, merchantOid, paid })
  }
  const after = await read()
  logger.info({
    event: "paytr.replay_result",
    cartId,
    orderId: after?.order?.id ?? null,
    number: after?.order?.display_id ?? null,
  })
}
