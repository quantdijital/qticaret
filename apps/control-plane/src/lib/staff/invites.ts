import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { inviteEmail, inviteLink } from "../mail/invite"
import { emailTransport } from "../mail/transport"
import type { CpStaffRole } from "./roles"

type Container = Pick<MedusaContainer, "resolve">

export interface InviteRow {
  id: string
  email: string
  token?: string
  metadata?: Record<string, unknown> | null
  expires_at: Date | string
  created_at: Date | string
}

/** An invitation as the staff page reads it: never its token. */
export const inviteView = (invite: InviteRow) => ({
  id: invite.id,
  email: invite.email,
  role: invite.metadata?.["role"] ?? null,
  expires_at: invite.expires_at,
  expired: new Date(invite.expires_at).getTime() < Date.now(),
  created_at: invite.created_at,
})

/** Whether the address already has a user or an open invitation. */
export async function addressTaken(
  container: Container,
  email: string
): Promise<"member" | "invited" | null> {
  const users = container.resolve(Modules.USER)
  if ((await users.listUsers({ email }, { select: ["id"], take: 1 })).length > 0) {
    return "member"
  }
  return (await users.listInvites({ email }, { select: ["id"], take: 1 })).length > 0
    ? "invited"
    : null
}

/**
 * The invitation by e-mail, and its link for whoever made it to pass on by
 * hand when there is no e-mail to send through (`mailed: false`). A send
 * that fails is logged by event only; the link still works.
 */
export async function sendInvite(
  container: Container,
  invite: InviteRow & { token: string },
  role: CpStaffRole
): Promise<{ link: string; mailed: boolean }> {
  const link = inviteLink(invite.token)
  const transport = emailTransport()
  if (!transport) {
    return { link, mailed: false }
  }
  try {
    await transport.send(inviteEmail(invite.email, role, link))
    return { link, mailed: true }
  } catch (error) {
    container
      .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      .warn(`cp.invite_mail_failed ${JSON.stringify({ err: errorSummary(error) })}`)
    return { link, mailed: false }
  }
}
