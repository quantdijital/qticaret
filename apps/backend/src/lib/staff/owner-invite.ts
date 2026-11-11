import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createInvitesWorkflow } from "@medusajs/medusa/core-flows"
import type { InviteOwnerResult } from "@qticaret/types/control-plane"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { inviteLink } from "./invite-link"

interface InviteRow {
  id: string
  email: string
  token?: string
  metadata?: Record<string, unknown> | null
}

const isBootstrap = (invite: InviteRow) => invite.metadata?.["bootstrap"] === true

/**
 * The setup's owner invitation (adr/0061 §5.7, Ek C10): the first person
 * in a new shop becomes its owner (adr/0040). A shop that has staff gets
 * none (`owner_exists`); an address that already has a user here is not
 * invited again (`address_taken`). Each call withdraws the open setup
 * invitations and that address's own, then makes a new one: "send again"
 * is the same call, and only the newest link works.
 *
 * The link goes back to the caller only (`tenant:invite-owner` prints it
 * for the provisioner, which mails it); it is never logged here.
 */
export async function createOwnerInvite(
  container: MedusaContainer,
  email: string
): Promise<InviteOwnerResult> {
  if (await container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).hasStaff()) {
    return { status: "owner_exists" }
  }
  const users = container.resolve(Modules.USER)
  if ((await users.listUsers({ email }, { select: ["id"], take: 1 })).length > 0) {
    return { status: "address_taken" }
  }
  const open = (await users.listInvites(
    {},
    { select: ["id", "email", "metadata"], take: 1000 }
  )) as InviteRow[]
  const withdrawn = open
    .filter((invite) => isBootstrap(invite) || invite.email.toLowerCase() === email)
    .map((invite) => invite.id)
  if (withdrawn.length > 0) {
    await users.deleteInvites(withdrawn)
  }
  const { result } = await createInvitesWorkflow(container).run({
    input: {
      invites: [{ email, metadata: { role: "owner", bootstrap: true, invited_by: null } }],
    },
  })
  const invite = result[0] as InviteRow | undefined
  if (!invite?.token) {
    throw new Error("invite-owner: the invitation was not made")
  }
  return { status: "invited", link: inviteLink(invite.token) }
}
