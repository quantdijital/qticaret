import type { MedusaContainer } from "@medusajs/framework/types"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { InvoicingSettings, ShippingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Who manages the shop's parcels (adr/0072 Ek 2026-11-26), from the two
 * settings that make it: BirFatura only while it is also the invoicing
 * program, so a stored choice never outlives the program it needs.
 */
export function birfaturaShipsWith(
  shipping: Pick<ShippingSettings, "manager">,
  invoicing: Pick<InvoicingSettings, "provider">
): boolean {
  return shipping.manager === "birfatura" && invoicing.provider === "birfatura"
}

const settingsOf = (container: Container) =>
  container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

/** Whether BirFatura's cargo module manages the shop's parcels now. */
export async function birfaturaShips(container: Container): Promise<boolean> {
  const [shipping, invoicing] = await Promise.all([
    settingsOf(container).readSection("shipping"),
    settingsOf(container).readSection("invoicing"),
  ])
  return birfaturaShipsWith(
    shipping.values as unknown as ShippingSettings,
    invoicing.values as unknown as InvoicingSettings
  )
}

/**
 * BirFatura is connected: the invoicing program, with the connection
 * password made (the same two things its door asks, `birfatura-guard.ts`).
 */
export async function birfaturaConnected(container: Container): Promise<boolean> {
  const invoicing = (await settingsOf(container).readSection("invoicing"))
    .values as unknown as InvoicingSettings
  if (invoicing.provider !== "birfatura") {
    return false
  }
  const account = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read("birfatura")
  return Boolean(account?.secrets["token"])
}
