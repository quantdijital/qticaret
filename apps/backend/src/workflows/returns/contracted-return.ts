import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { carrierOf } from "../../lib/shipping/carriers"
import type { CarrierName } from "../../lib/shipping/carriers"
import { contractedReturnOf } from "../../lib/shipping/contracted-return"
import type { ContractedReturn } from "../../lib/shipping/contracted-return"
import { birfaturaShipsWith } from "../../lib/shipping/manager"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type {
  InvoicingSettings,
  ReturnsSettings,
  ShippingSettings,
} from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

/** The carrier behind the shop's main shipping option; null for its own delivery or none. */
async function primaryCarrierOf(
  container: Container,
  optionId: string | null
): Promise<CarrierName | null> {
  if (!optionId) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: ["id", "provider_id"],
    filters: { id: optionId },
  })
  return carrierOf((data[0] as { provider_id?: string | null } | undefined)?.provider_id)
}

/**
 * The shop's contracted return code now (adr/0031 Ek 2026-11-26), read
 * from its settings (cached) by `contractedReturnOf`'s rule. The main
 * option is looked up only when more than one of our carriers has a code.
 */
export async function readContractedReturn(container: Container): Promise<ContractedReturn | null> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [returns, shipping, invoicing] = (await Promise.all([
    settings.getSection("returns"),
    settings.getSection("shipping"),
    settings.getSection("invoicing"),
  ])) as unknown as [ReturnsSettings, ShippingSettings, InvoicingSettings]
  const codes = returns.contracted_return
  const birfatura = birfaturaShipsWith(shipping, invoicing)
  const primaryCarrier =
    !birfatura && [codes.aras, codes.yurtici, codes.dhlecommerce].filter(Boolean).length > 1
      ? await primaryCarrierOf(container, shipping.primary_option_id)
      : null
  return contractedReturnOf({ codes, birfatura, primaryCarrier })
}
