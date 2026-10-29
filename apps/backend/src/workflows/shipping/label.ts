import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { imposePdfs } from "../../lib/pdf"
import { labelSheetOf } from "../../lib/shipping/label-sheet"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { ShippingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

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

/**
 * The stored labels of up to 20 parcels as one PDF to print (F7.7, with
 * pdf-lib): in the order asked, every page of each, on the shop's label
 * size (Settings > Shipping). A parcel with no label, or one that cannot
 * be read, is left out and counted.
 */
export async function bulkLabels(
  container: MedusaContainer,
  fulfillmentIds: readonly string[]
): Promise<{ pdf: Uint8Array; missing: number } | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "fulfillment",
    fields: ["id", "data"],
    filters: { id: [...fulfillmentIds] },
  })
  const keys = new Map(
    (data as { id: string; data?: Record<string, unknown> | null }[]).map((row) => [
      row.id,
      row.data?.["label_file_id"],
    ])
  )
  const files = container.resolve(Modules.FILE)
  const parts: Uint8Array[] = []
  for (const id of fulfillmentIds) {
    const key = keys.get(id)
    if (typeof key === "string") {
      parts.push(await files.getAsBuffer(key))
    }
  }
  if (parts.length === 0) {
    return null
  }
  const shipping = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("shipping")) as unknown as ShippingSettings
  const { pdf, skipped } = await imposePdfs(parts, labelSheetOf(shipping))
  if (skipped.length === parts.length) {
    return null
  }
  return { pdf, missing: fulfillmentIds.length - parts.length + skipped.length }
}
