import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { WholesaleEnabledVars, WholesaleInviteVars } from "../../../lib/messaging/templates"
import { inviteExpiresAt, isInviteLive } from "../../../lib/wholesale"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import type WholesaleModuleService from "../../../modules/wholesale/service"
import { brandOf } from "../brand"
import { REGISTER_PATH } from "./migration"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">

/** The storefront's sign-in page (F18). */
export const LOGIN_PATH = "/hesap/giris"

const RESOURCE = "wholesale_account"

async function accountOf(container: Container, id: string) {
  const [account] = await container
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .listWholesaleAccounts({ id }, { take: 1 })
  return account ?? null
}

/** A day as the shop's customers read it, in the shop's time zone. */
async function dayOf(container: Container, at: Date): Promise<string> {
  const store = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: store.timezone }).format(
    at
  )
}

/**
 * A pending wholesaler's invitation (ADR-0068 §3): to the address the
 * account holds, to the storefront's sign-up page. No address and no key
 * in the link: signing up with the invited address is the proof, and the
 * account is taken on sign-in. Nothing goes without the storefront's
 * address, nor for an invitation past its 90 days.
 */
export async function loadWholesaleInvite(
  container: Container,
  accountId: string
): Promise<Loaded<WholesaleInviteVars> | null> {
  const account = await accountOf(container, accountId)
  const { storefrontUrl } = await brandOf(container)
  const invitedAt = account?.invited_at ? new Date(account.invited_at) : null
  if (
    account?.status !== "pending" ||
    !account.email ||
    !invitedAt ||
    !isInviteLive({ invitedAt, openedAt: account.created_at }, new Date()) ||
    !storefrontUrl
  ) {
    return null
  }
  return {
    vars: {
      registerUrl: `${storefrontUrl}${REGISTER_PATH}`,
      expiresAt: await dayOf(
        container,
        inviteExpiresAt({ invitedAt, openedAt: account.created_at })
      ),
    },
    recipients: { email: account.email },
    receiverId: null,
    resourceType: RESOURCE,
  }
}

/** An active wholesaler's "your wholesale account is open", to their customer record's address. */
export async function loadWholesaleEnabled(
  container: Container,
  accountId: string
): Promise<Loaded<WholesaleEnabledVars> | null> {
  const account = await accountOf(container, accountId)
  const { storefrontUrl } = await brandOf(container)
  if (account?.status !== "active" || !account.customer_id || !storefrontUrl) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: account.customer_id },
  })
  const email = (data[0] as { email?: string | null } | undefined)?.email
  if (!email) {
    return null
  }
  return {
    vars: { loginUrl: `${storefrontUrl}${LOGIN_PATH}` },
    recipients: { email },
    receiverId: account.customer_id,
    resourceType: RESOURCE,
  }
}
