import type { MedusaContainer } from "@medusajs/framework/types"
import { identityGaps } from "../../lib/legal"
import type { IdentityField } from "../../lib/legal"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { LegalSettings, StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

export interface LegalIdentity extends LegalSettings {
  contact_email: string | null
  contact_phone: string | null
  /** The required details still missing; empty once the identity is complete. */
  gaps: IdentityField[]
}

/** The shop's legal identity with its contact details, and what it still lacks (F13.9). */
export async function legalIdentity(container: Container): Promise<LegalIdentity> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [legal, store] = await Promise.all([
    settings.getSection("legal") as Promise<unknown> as Promise<LegalSettings>,
    settings.getSection("store") as Promise<unknown> as Promise<StoreSettings>,
  ])
  const facts = {
    ...legal,
    contact_email: store.contact_email,
    contact_phone: store.contact_phone,
  }
  return { ...facts, gaps: identityGaps(facts) }
}
