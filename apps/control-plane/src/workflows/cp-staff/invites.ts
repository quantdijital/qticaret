import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { acceptInviteWorkflow, createInvitesWorkflow } from "@medusajs/medusa/core-flows"
import { CP_INVITABLE_ROLES } from "../../lib/staff/roles"
import type { CpStaffRole } from "../../lib/staff/roles"
import { CP_STAFF_MODULE } from "../../modules/cp-staff"
import type CpStaffModuleService from "../../modules/cp-staff/service"

/**
 * Platform staff invitations (adr/0061 §3.5; the shop's staff invites,
 * adr/0040 §4, copied): Medusa's invitation with the role in its metadata,
 * read back on acceptance by our own route (Medusa's acceptance gives no
 * role and is unreachable here: the allowlist answers 404). An owner comes
 * only from a bootstrap invitation (`cp:create-owner`), and only while the
 * control plane has no active owner.
 */

export interface InviteFacts {
  id: string
  email: string
  role: CpStaffRole
  invited_by: string | null
}

type Container = Pick<MedusaContainer, "resolve">

const invalid = () => new MedusaError(MedusaError.Types.INVALID_DATA, "cp.invite_invalid")

const staff = (container: Container) => container.resolve<CpStaffModuleService>(CP_STAFF_MODULE)

/** What an invitation offers, read from a token that is still good; anything else is refused. */
export async function inviteOfToken(container: Container, token: string): Promise<InviteFacts> {
  const invite = (await container
    .resolve(Modules.USER)
    .validateInviteToken(token)
    .catch(() => null)) as {
    id: string
    email: string
    metadata?: Record<string, unknown> | null
  } | null
  const role = invite?.metadata?.["role"]
  const invitable = (CP_INVITABLE_ROLES as readonly unknown[]).includes(role)
  const bootstrap =
    role === "owner" &&
    invite?.metadata?.["bootstrap"] === true &&
    !(await staff(container).hasActiveOwner())
  if (!invite || !(invitable || bootstrap)) {
    throw invalid()
  }
  const by = invite.metadata?.["invited_by"]
  return {
    id: invite.id,
    email: invite.email,
    role: role as CpStaffRole,
    invited_by: typeof by === "string" ? by : null,
  }
}

/** An invitation with the role it gives. `bootstrap` only from `cp:create-owner`. */
export const inviteCpStaffWorkflow = createWorkflow(
  "cp-staff-invite",
  (
    input: WorkflowData<{
      email: string
      role: CpStaffRole
      invited_by: string | null
      bootstrap?: boolean
    }>
  ) => {
    const invites = createInvitesWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        invites: [
          {
            email: input.email,
            metadata: {
              role: input.role,
              invited_by: input.invited_by,
              ...(input.bootstrap ? { bootstrap: true } : {}),
            },
          },
        ],
      })),
    })
    return new WorkflowResponse(invites)
  }
)

/** Whether the login is the invited address's: a link passed on cannot make another person staff. */
async function loginIsFor(
  container: Container,
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
  "cp-staff-read-invite",
  async (input: { token: string; auth_identity_id: string }, { container }) => {
    const invite = await inviteOfToken(container, input.token)
    if (!(await loginIsFor(container, input.auth_identity_id, invite.email))) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.invite_login")
    }
    return new StepResponse(invite)
  }
)

/** The invitation's role to the new member; undone, they have none. */
const giveRoleStep = createStep(
  "cp-staff-give-role",
  async (input: { user_id: string; role: CpStaffRole; by: string | null }, { container }) => {
    await staff(container).setRole(input.user_id, input.role, input.by)
    return new StepResponse(input.user_id, input.user_id)
  },
  async (userId: string | undefined, { container }) => {
    if (userId) {
      await staff(container).removeMember(userId)
    }
  }
)

/**
 * An invitation accepted: its role read first (Medusa deletes the
 * invitation as it makes the user), the login checked to be the invited
 * address's, the user made under that address, then the role given.
 */
export const acceptCpStaffInviteWorkflow = createWorkflow(
  "cp-staff-accept-invite",
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
    }))
    giveRoleStep(member)
    return new WorkflowResponse(member)
  }
)
