import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * A short-lived link to a fulfillment's stored label (adr/0031), when the
 * fulfillment belongs to the order and has one; null otherwise.
 */
export async function shipmentLabel(
  container: MedusaContainer,
  orderId: string,
  fulfillmentId: string
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["fulfillments.id", "fulfillments.data"],
    filters: { id: orderId },
  })
  const fulfillment = (
    (
      data[0] as
        | { fulfillments?: ({ id: string; data?: Record<string, unknown> | null } | null)[] }
        | undefined
    )?.fulfillments ?? []
  ).find((each) => each?.id === fulfillmentId)
  const key = fulfillment?.data?.["label_file_id"]
  if (typeof key !== "string") {
    return null
  }
  return (await container.resolve(Modules.FILE).retrieveFile(key)).url
}
