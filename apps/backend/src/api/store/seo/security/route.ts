import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { parseEnv } from "../../../../lib/env"
import { securityTxt } from "../../../../lib/security/security-txt"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import type { SeoSettings } from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"

/**
 * `GET /store/seo/security` (F15.9, RFC 9116): the shop's security.txt,
 * served by the storefront at `/.well-known/security.txt`. 404 until the
 * platform's security contact is set (`SECURITY_CONTACT`).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const env = parseEnv()
  const seo = (await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("seo")) as unknown as SeoSettings
  const text = securityTxt({
    contacts: env.SECURITY_CONTACT,
    policyUrl: env.SECURITY_POLICY_URL,
    canonicalHost: seo.canonical_host,
  })
  if (!text) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.security_txt_unset")
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "public, max-age=3600")
  res.send(text)
}
