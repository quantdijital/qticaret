import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { parseKey } from "@qticaret/server-kit"
import { maskRecipient, normalizeRecipient } from "../../../lib/messaging/recipients"
import type { StaffAccountVars, StaffEmailConfirmVars } from "../../../lib/messaging/templates"
import { parseEnv } from "../../../lib/env"
import { emailChangeLink, parseEmailChange, sealEmailChange } from "../../../lib/staff/account"
import { staffAccountStore } from "../../../lib/staff/account-store"
import type { AccountStore } from "../../../lib/staff/account-store"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A new login address's confirmation (the owner, 2026-11-06): to the new
 * address of the member's waiting change, the panel's page with the link
 * sealed here, as it goes (security review 2026-11-06): no workflow input
 * carries the token. Nothing waiting, nothing sent.
 */
export async function loadStaffEmailConfirm(
  _container: Container,
  userId: string,
  _extra: Readonly<Record<string, string>>,
  store: AccountStore = staffAccountStore(),
  key: Buffer = parseKey(parseEnv().PII_ENCRYPTION_KEY, "PII_ENCRYPTION_KEY")
): Promise<Loaded<StaffEmailConfirmVars> | null> {
  const claim = parseEmailChange(await store.getPending(userId))
  if (claim?.user_id !== userId || claim.expires_at <= Date.now()) {
    return null
  }
  return {
    vars: { confirmUrl: emailChangeLink(sealEmailChange(claim, key)) },
    recipients: { email: claim.to },
    receiverId: null,
    resourceType: "user",
  }
}

const CHANGES = new Set<string>(["password", "email_requested", "email_changed"])

/**
 * A staff member told their password or login address changed: to the
 * address the send names (the old one, for an address change), else to
 * their login as it is when it goes. The new address shows masked.
 */
export async function loadStaffAccountChanged(
  container: Container,
  userId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<StaffAccountVars> | null> {
  const change = extra["change"] ?? ""
  if (!CHANGES.has(change)) {
    return null
  }
  const to = extra["to"] ? normalizeRecipient("email", extra["to"]) : null
  let email = extra["email"] ?? null
  if (!email) {
    const [user] = await container
      .resolve(Modules.USER)
      .listUsers({ id: userId }, { select: ["email"], take: 1 })
    email = user?.email ?? null
  }
  return email
    ? {
        vars: {
          change: change as StaffAccountVars["change"],
          address: to ? maskRecipient("email", to) : null,
        },
        recipients: { email },
        receiverId: null,
        resourceType: "user",
      }
    : null
}
