import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import type { AnnouncementVars, ResetVars, VerifyVars } from "../../../lib/messaging/templates"
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

/**
 * A shop's announcement to one customer (F9.5): the words come with the
 * send (F10's campaigns), the addresses from the customer. Whether it may
 * go is deliver()'s: commercial, so only with consent on the channel.
 */
export async function loadAnnouncement(
  container: Container,
  customerId: string,
  extra: Extra
): Promise<Loaded<AnnouncementVars> | null> {
  const { title, body, url } = extra
  if (!title || !body) {
    return null
  }
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "customer", fields: ["email", "phone"], filters: { id: customerId } })
  const customer = data[0] as { email: string | null; phone: string | null } | undefined
  if (!customer) {
    return null
  }
  return {
    vars: { title, body, url: url ?? null },
    recipients: { email: customer.email, sms: customer.phone },
    receiverId: customerId,
    resourceType: "customer",
  }
}
