import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { birfaturaConnected } from "../../../lib/shipping/manager"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { ShippingSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type { StoredSection } from "../../../modules/platform-settings/service"
import type { SaveSettingsSectionInput } from "./save-settings-section"

const managerOf = (values: unknown): unknown =>
  (values as Record<string, unknown> | null | undefined)?.["manager"]

/**
 * "Kargoyu nereden yönetiyorsun?" answered BirFatura (adr/0072 Ek
 * 2026-11-26): only while BirFatura is the connected invoicing program,
 * since its cargo module ships the orders it pulls from us. A save that
 * sends the stored choice as it is stays allowed. Reads only.
 */
export const assertShippingManagerStep = createStep(
  "platform-settings-assert-shipping-manager",
  async (input: Pick<SaveSettingsSectionInput, "section" | "values">, { container }) => {
    if (input.section !== "shipping" || managerOf(input.values) !== "birfatura") {
      return new StepResponse(true)
    }
    const stored = await container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .readSection("shipping")
    if (
      (stored.values as unknown as ShippingSettings).manager !== "birfatura" &&
      !(await birfaturaConnected(container))
    ) {
      throw new ValidationError("shipping.birfatura_not_connected", { field: "manager" })
    }
    return new StepResponse(true)
  }
)

interface Restore {
  previous: StoredSection | null
  version: number
}

/**
 * BirFatura is no longer the invoicing program: its cargo module no longer
 * manages the parcels, the shop's own way is back (`own`). Undone by
 * putting the section back, only over the version this wrote.
 */
export const resetShippingManagerStep = createStep(
  "platform-settings-reset-shipping-manager",
  async (input: { actor_id: string | null }, { container }) => {
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const stored = await service.readSection("shipping")
    if ((stored.values as unknown as ShippingSettings).manager !== "birfatura") {
      return new StepResponse(false, null)
    }
    const change = await service.saveSection("shipping", { manager: "own" }, input.actor_id)
    return new StepResponse<boolean, Restore | null>(true, {
      previous: change.previous,
      version: change.version,
    })
  },
  async (restore, { container }) => {
    if (!restore) {
      return
    }
    await container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .restoreSection("shipping", restore.previous, restore.version)
  }
)
