import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isNonWithdrawableLine } from "../../lib/catalog/addons"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { ReturnsSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

/** The shop's return policy (F13.6): its withdrawal period and who pays the return. */
export async function returnPolicy(container: Container): Promise<ReturnsSettings> {
  return (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("returns")) as unknown as ReturnsSettings
}

/**
 * The order's lines outside the right of withdrawal, by line id: their
 * product's mark (F13.6), or an add-on made to the buyer's wish that the
 * line records (adr/0052 §8; the record as sold, not the product now).
 */
export async function excludedLines(
  container: Container,
  items: readonly ({ id: string; product_id?: string | null; metadata?: unknown } | null)[]
): Promise<Set<string>> {
  const byAddon = items.flatMap((item) =>
    item && isNonWithdrawableLine(item.metadata) ? [item.id] : []
  )
  const productIds = [
    ...new Set(items.flatMap((item) => (item?.product_id ? [item.product_id] : []))),
  ]
  if (productIds.length === 0) {
    return new Set(byAddon)
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "product_extension.withdrawal_excluded"],
    filters: { id: productIds },
  })
  const excluded = new Set(
    (data as { id: string; product_extension?: { withdrawal_excluded?: boolean } | null }[])
      .filter((product) => product.product_extension?.withdrawal_excluded)
      .map((product) => product.id)
  )
  return new Set([
    ...byAddon,
    ...items.flatMap((item) =>
      item?.product_id && excluded.has(item.product_id) ? [item.id] : []
    ),
  ])
}
