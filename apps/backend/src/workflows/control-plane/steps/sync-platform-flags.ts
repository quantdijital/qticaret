import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTROL_PLANE_MODULE } from "../../../modules/control-plane"
import type ControlPlaneModuleService from "../../../modules/control-plane/service"
import type { StoreOutcome } from "../../../modules/control-plane/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type {
  PlatformFlagSync,
  default as PlatformSettingsModuleService,
} from "../../../modules/platform-settings/service"

export interface SyncPlatformFlagsInput {
  tenant_id: string
  outcome: StoreOutcome
}

interface Undo {
  previous: PlatformFlagSync["previous"]
  serial: number
}

/**
 * The platform flags of the document **stored now** given to the flag
 * registry's store (adr/0012, adr/0061 §5.2, C9 review M1), with its
 * serial: not the flags this workflow was handed, which a newer document
 * may have replaced in between. The store never writes a smaller serial,
 * so two applies racing end with the newer one's flags. It runs on `same`
 * too, so an earlier interrupted sync heals; not on `stale`. Undone to the
 * set before only while nothing newer was stored over it.
 */
export const syncPlatformFlagsStep = createStep<
  SyncPlatformFlagsInput,
  { ignored: string[] },
  Undo | null
>(
  "control-plane-sync-platform-flags",
  async (input: SyncPlatformFlagsInput, { container }) => {
    if (input.outcome === "stale") {
      return new StepResponse({ ignored: [] as string[] }, null)
    }
    const stored = await container
      .resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
      .storedPlan(input.tenant_id)
    if (!stored) {
      return new StepResponse({ ignored: [] as string[] }, null)
    }
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const sync = await service.syncPlatformFlags(stored.document.platform_flags, stored.serial)
    return new StepResponse(
      { ignored: sync.ignored },
      sync.written ? { previous: sync.previous, serial: stored.serial } : null
    )
  },
  async (undo: Undo | null | undefined, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    await service.undoPlatformFlagSync(undo.previous, undo.serial)
  }
)
