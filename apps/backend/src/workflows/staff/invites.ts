import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { acceptInviteWorkflow, createInvitesWorkflow } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { INVITABLE_ROLES } from "../../lib/staff"
import type { InvitableRole } from "../../lib/staff"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"

export interface InviteFacts {
  id: string
  email: string
  role: InvitableRole | "owner"
  invited_by: string | null
  /** The setup's owner invitation (`tenant:invite-owner`, adr/0061 §5.7). */
  bootstrap: boolean
}

const isInvitable = (value: unknown): value is InvitableRole =>
  typeof value === "string" && (INVITABLE_ROLES as readonly string[]).includes(value)

const staffRolesOf = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)

/**
 * What an invitation offers, read from a token that is still good; anything
 * else is refused. An owner is offered only by the setup's invitation, and
 * only while the shop has no staff: once anyone is in, it is dead.
 */
export async function inviteOfToken(
  container: Pick<MedusaContainer, "resolve">,
  token: string
): Promise<InviteFacts> {
  const invite = (await container
    .resolve(Modules.USER)
    .validateInviteToken(token)
    .catch(() => null)) as {
    id: string
    email: string
    metadata?: Record<string, unknown> | null
  } | null
  const role = invite?.metadata?.["role"]
  const bootstrap = invite?.metadata?.["bootstrap"] === true && role === "owner"
  if (!invite || !(isInvitable(role) || bootstrap)) {
    throw new ValidationError("staff.invite_invalid")
  }
  if (bootstrap && (await staffRolesOf(container).hasStaff())) {
    throw new ValidationError("staff.invite_invalid")
  }
  const by = invite.metadata?.["invited_by"]
  return {
    id: invite.id,
    email: invite.email,
    role: bootstrap ? "owner" : role,
    invited_by: typeof by === "string" ? by : null,
    bootstrap,
  }
}

/**
 * An invitation to the panel with the role it gives (F12.6, adr/0040 §4):
 * Medusa's invitation, the role in its metadata, read back on acceptance.
 */
export const inviteStaffWorkflow = createWorkflow(
  "staff-invite",
  (input: WorkflowData<{ email: string; role: InvitableRole; invited_by: string }>) => {
    const invites = createInvitesWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        invites: [
          { email: input.email, metadata: { role: input.role, invited_by: input.invited_by } },
        ],
      })),
    })
    return new WorkflowResponse(invites)
  }
)

/** Whether the login is the invited address's: a link passed on cannot make another person staff. */
async function loginIsFor(
  container: Pick<MedusaContainer, "resolve">,
  authIdentityId: string,
  email: string
): Promise<boolean> {
  const identity = await container
    .resolve(Modules.AUTH)
    .retrieveAuthIdentity(authIdentityId, { relations: ["provider_identities"] })
    .catch(() => null)
  const wanted = email.trim().toLowerCase()
  return (identity?.provider_identities ?? []).some(
    (each) => each.provider === "emailpass" && each.entity_id.trim().toLowerCase() === wanted
  )
}

const readInviteStep = createStep(
  "staff-read-invite",
  async (input: { token: string; auth_identity_id: string }, { container }) => {
    const invite = await inviteOfToken(container, input.token)
    if (!(await loginIsFor(container, input.auth_identity_id, invite.email))) {
      throw new ValidationError("staff.invite_login")
    }
    return new StepResponse(invite)
  }
)

/**
 * The invitation's role to the new member; undone, they have none. The
 * setup's owner invitation makes them owner only if the shop still has no
 * staff (checked again under the first-owner lock): otherwise refused, and
 * Medusa's acceptance before this step is undone.
 */
const giveRoleStep = createStep(
  "staff-give-role",
  async (
    input: {
      user_id: string
      role: InvitableRole | "owner"
      by: string | null
      bootstrap: boolean
    },
    { container }
  ) => {
    if (input.bootstrap) {
      if (!(await staffRolesOf(container).claimBootstrapOwner(input.user_id))) {
        throw new ValidationError("staff.invite_invalid")
      }
      // The last step: nothing after it fails, and the shop's only owner is never taken back
      return new StepResponse(input.user_id, "")
    }
    await staffRolesOf(container).setRole(input.user_id, input.role, input.by)
    return new StepResponse(input.user_id, input.user_id)
  },
  async (userId: string | undefined, { container }) => {
    if (userId) {
      await staffRolesOf(container).removeRole(userId)
    }
  }
)

/**
 * An invitation accepted: its role read first (Medusa deletes the
 * invitation as it makes the user), the login checked to be the invited
 * address's, the user made under that address, then the role given.
 */
export const acceptStaffInviteWorkflow = createWorkflow(
  "staff-accept-invite",
  (
    input: WorkflowData<{
      token: string
      auth_identity_id: string
      first_name: string
      last_name: string
    }>
  ) => {
    const invite = readInviteStep({ token: input.token, auth_identity_id: input.auth_identity_id })
    const users = acceptInviteWorkflow.runAsStep({
      input: transform({ input, invite }, ({ input, invite }) => ({
        invite_token: input.token,
        auth_identity_id: input.auth_identity_id,
        user: { email: invite.email, first_name: input.first_name, last_name: input.last_name },
      })),
    })
    const member = transform({ users, invite }, ({ users, invite }) => ({
      user_id: users[0]?.id ?? "",
      role: invite.role,
      by: invite.invited_by,
      bootstrap: invite.bootstrap,
    }))
    giveRoleStep(member)
    return new WorkflowResponse(member)
  }
)
