import type { MedusaContainer } from "@medusajs/framework/types"
import { identityGaps } from "../../lib/legal"
import type { IdentityField } from "../../lib/legal"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { LegalSettings, StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The shop's public identity (F13.9, adr/0048): its legal details and how
 * it is reached, from the legal section and the store details. The one
 * source the footer, the contact page, the legal texts, the structured
 * data and the e-mails read.
 */
export interface LegalIdentity extends LegalSettings {
  contact_email: string | null
  contact_phone: string | null
  whatsapp_phone: string | null
  opening_hours: StoreSettings["opening_hours"]
  map_url: string | null
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
    whatsapp_phone: store.whatsapp_phone,
    opening_hours: store.opening_hours,
    map_url: store.map_url,
  }
  return { ...facts, gaps: identityGaps(facts) }
}
/** The licence line (adr/0076 §12) once it has a name and a number; its holder only when given. */
export function documentLineOf(identity: {
  document_name: string | null
  document_number: string | null
  document_holder: string | null
}): { name: string; number: string; holder: string | null } | null {
  return identity.document_name && identity.document_number
    ? {
        name: identity.document_name,
        number: identity.document_number,
        holder: identity.document_holder,
      }
    : null
}
