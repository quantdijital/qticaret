import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type { StoreOutcome } from "../../../modules/control-plane/service"

export interface SyncPlatformFlagsInput {
  outcome: StoreOutcome
  flags: Record<string, boolean>
}

/**
 * The document's platform flags into the flag registry's store (adr/0012,
 * adr/0061 §5.2), only when the document was applied; undone to the set
 * before. Keys this shop does not know are named back, not stored.
 */
export const syncPlatformFlagsStep = createStep<
  SyncPlatformFlagsInput,
  { ignored: string[] },
  Record<string, boolean> | null
>(
  "control-plane-sync-platform-flags",
  async (input: SyncPlatformFlagsInput, { container }) => {
    if (input.outcome !== "applied") {
      return new StepResponse({ ignored: [] as string[] }, null)
    }
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const { previous, ignored } = await service.syncPlatformFlags(input.flags)
    return new StepResponse({ ignored }, previous)
  },
  async (previous: Record<string, boolean> | null | undefined, { container }) => {
    if (!previous) {
      return
    }
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    await service.syncPlatformFlags(previous)
  }
)
