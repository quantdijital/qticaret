import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { carrierOf } from "../../lib/shipping/carriers"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

/**
 * Whether the order goes with a carrier whose account is in test mode: no
 * courier comes and nothing leaves the shop, so an order paid in a
 * provider's test mode may go that way, to try the whole flow (adr/0027
 * amended 2026-10-29). Real money is still needed for a live carrier or
 * the shop's own delivery.
 */
export async function shipsWithTestCarrier(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
): Promise<boolean> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["shipping_methods.shipping_option_id"],
    filters: { id: orderId },
  })
  const order = data[0] as
    { shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null } | undefined
  const optionId = (order?.shipping_methods ?? []).find(
    (method) => method?.shipping_option_id
  )?.shipping_option_id
  if (!optionId) {
    return false
  }
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["provider_id"],
    filters: { id: optionId },
  })
  const carrier = carrierOf(
    (options[0] as { provider_id?: string | null } | undefined)?.provider_id
  )
  if (!carrier) {
    return false
  }
  const account = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read(carrier)
  return account?.settings["test_mode"] === true
}
