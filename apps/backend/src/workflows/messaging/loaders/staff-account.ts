import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { maskRecipient, normalizeRecipient } from "../../../lib/messaging/recipients"
import type { StaffAccountVars, StaffEmailConfirmVars } from "../../../lib/messaging/templates"
import { emailChangeLink } from "../../../lib/staff/account"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A new login address's confirmation (the owner, 2026-11-06): to the new
 * address, the panel's page with the token only the request knew.
 */
export function loadStaffEmailConfirm(
  _container: Container,
  _userId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<StaffEmailConfirmVars> | null> {
  const { email, token } = extra
  if (!email || !token) {
    return Promise.resolve(null)
  }
  return Promise.resolve({
    vars: { confirmUrl: emailChangeLink(token) },
    recipients: { email },
    receiverId: null,
    resourceType: "user",
  })
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
