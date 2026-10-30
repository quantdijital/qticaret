import type { MedusaContainer } from "@medusajs/framework/types"
import { SEARCH_CONSOLE_SCOPE, googleClientOf } from "../../lib/google/oauth"
import { REQUIRED_KINDS } from "../../lib/legal"
import { seoSetup } from "../../lib/seo/setup-checklist"
import type { SeoSetupEntry } from "../../lib/seo/setup-checklist"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { SEO_INDEXNOW } from "../../modules/platform-settings/features"
import type { SeoSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { legalIdentity } from "../legal/identity"

type Container = Pick<MedusaContainer, "resolve">

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null

/** The shop's SEO setup checklist (F12.10), judged from its settings; nothing personal. */
export async function seoSetupChecklist(container: Container): Promise<SeoSetupEntry[]> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [section, indexNow, google, identity, published] = await Promise.all([
    settings.getSection("seo"),
    settings.isFeatureEnabled(SEO_INDEXNOW),
    container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .describe("google"),
    legalIdentity(container),
    container
      .resolve<LegalModuleService>(LEGAL_MODULE)
      .listLegalDocuments({ status: "published" }, { select: ["kind"] }),
  ])
  const publishedKinds = new Set(published.map((row) => row.kind))
  const seo = section as unknown as SeoSettings
  const scopes = (text(google.settings?.["scopes"]) ?? "").split(" ")
  // An account saved but rejected or unreadable is not connected yet
  const connected = google.state === "connected" || google.state === "unverified"
  return seoSetup({
    legalIdentity: identity.gaps.length === 0,
    legalTexts: REQUIRED_KINDS.every((kind) => publishedKinds.has(kind)),
    canonicalHost: seo.canonical_host,
    robotsTxt: seo.robots_txt,
    shareImage: seo.default_og_image,
    google: {
      platform: googleClientOf() !== null,
      connected,
      searchConsole:
        connected &&
        scopes.includes(SEARCH_CONSOLE_SCOPE) &&
        text(google.settings?.["gsc_site"]) !== null,
      merchant: connected && text(google.settings?.["merchant_id"]) !== null,
    },
    indexNow,
  })
}
