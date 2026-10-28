import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../../lib/logging"
import type { ResetVars, VerifyVars } from "../../../lib/messaging/templates"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import { brandOf } from "../brand"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">
type Extra = Readonly<Record<string, string>>

/** The storefront page a reset link opens (F18 builds it), with the token and the address. */
export const RESET_PATH = "/hesap/sifre-yenile"

/**
 * A customer's reset link (auth.password_reset). The link needs the
 * storefront's address: without a domain there is nowhere to send them,
 * and nothing is sent.
 */
export async function loadPasswordReset(
  container: Container,
  _resourceId: string,
  extra: Extra
): Promise<Loaded<ResetVars> | null> {
  const { email, token } = extra
  const { storefrontUrl } = await brandOf(container)
  if (!email || !token || !storefrontUrl) {
    logger.info({
      event: "messaging.not_sent",
      template: "account.password_reset",
      reason: "no_link",
    })
    return null
  }
  return {
    vars: {
      resetUrl: `${storefrontUrl}${RESET_PATH}?${new URLSearchParams({ token, email }).toString()}`,
    },
    recipients: { email },
    receiverId: null,
    resourceType: "auth_identity",
  }
}

/** The code to confirm an e-mail address (auth.verification_requested), to the address itself. */
export async function loadVerification(
  container: Container,
  _resourceId: string,
  extra: Extra
): Promise<Loaded<VerifyVars> | null> {
  const { email, code, expires_at: expiresAt } = extra
  if (!email || !code) {
    return null
  }
  const store = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  const expires = expiresAt ? new Date(expiresAt) : null
  return {
    vars: {
      code,
      expiresAt:
        expires && !Number.isNaN(expires.getTime())
          ? new Intl.DateTimeFormat("tr-TR", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: store.timezone,
            }).format(expires)
          : null,
    },
    recipients: { email },
    receiverId: null,
    resourceType: "auth_identity",
  }
}
