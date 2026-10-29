import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { errorSummary, logger } from "../../../lib/logging"
import { inviteLink } from "../../../lib/staff"
import type { InvitableRole } from "../../../lib/staff"
import { sendMessageWorkflow } from "../../../workflows/messaging/send-message"

export interface InviteRow {
  id: string
  email: string
  token?: string
  metadata?: Record<string, unknown> | null
  expires_at: Date | string
  created_at: Date | string
}

/** An invitation as the team page reads it: never its token. */
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
  container: Pick<MedusaContainer, "resolve">,
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
 * The invitation by e-mail, and its link for the owner to pass on by hand
 * when there is no e-mail to send through. A send that fails is logged;
 * the link still works.
 */
export async function sendInvite(
  container: MedusaContainer,
  invite: InviteRow & { token: string },
  role: InvitableRole
): Promise<string> {
  await sendMessageWorkflow(container)
    .run({
      input: {
        template: "staff.invite",
        resource_id: invite.id,
        // A new token is a new send
        key: createHash("sha256").update(invite.token).digest("hex").slice(0, 16),
        extra: { email: invite.email, token: invite.token, role },
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "staff.invite_mail_failed", err: errorSummary(error) })
    })
  return inviteLink(invite.token)
}
