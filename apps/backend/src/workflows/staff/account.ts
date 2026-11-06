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
import { updateUsersWorkflow } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { jobTitleOf, withJobTitle } from "../../lib/staff/account"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import {
  checkNewPasswordStep,
  notePasswordChangedStep,
  setPasswordStep,
  tellAccountChangedStep,
} from "./account-steps"

type Container = Pick<MedusaContainer, "resolve">

/** The signed-in member as their own profile shows them. */
export interface StaffProfile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  role: string | null
  created_at: string
}

/** The member's profile, read by their own id; null when the user is gone. */
export async function profileOf(
  container: Container,
  userId: string
): Promise<StaffProfile | null> {
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers(
      { id: userId },
      { select: ["id", "email", "first_name", "last_name", "metadata", "created_at"], take: 1 }
    )
  if (!user) {
    return null
  }
  const role = await container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId)
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    job_title: jobTitleOf(user.metadata),
    role,
    created_at: new Date(user.created_at).toISOString(),
  }
}

/** The user's metadata as it is, so the job title joins it rather than replacing it. */
const readMetadataStep = createStep(
  "staff-read-metadata",
  async (userId: string, { container }) => {
    const [user] = await container
      .resolve(Modules.USER)
      .listUsers({ id: userId }, { select: ["id", "metadata"], take: 1 })
    if (!user) {
      throw new ValidationError("staff.unknown")
    }
    return new StepResponse(user.metadata ?? null)
  }
)

/**
 * A member's own name and job title (the owner, 2026-11-06): Medusa's
 * user update (its own step undoes itself), the title in the metadata.
 */
export const updateStaffProfileWorkflow = createWorkflow(
  { name: "staff-update-profile", store: false },
  (
    input: WorkflowData<{
      user_id: string
      first_name: string
      last_name: string
      job_title: string | null
    }>
  ) => {
    const metadata = readMetadataStep(input.user_id)
    const updates = transform({ input, metadata }, ({ input, metadata }) => ({
      updates: [
        {
          id: input.user_id,
          first_name: input.first_name,
          last_name: input.last_name,
          metadata: withJobTitle(metadata, input.job_title),
        },
      ],
    }))
    updateUsersWorkflow.runAsStep({ input: updates })
    return new WorkflowResponse(input.user_id)
  }
)

/**
 * A member's own password (the owner, 2026-11-06): the current one proved
 * by the route before this runs, the new one (sealed for the request) by
 * the platform's rule, set on the login (undone to the old hash), the time
 * kept for the tokens before it (undone too), then the member told. Never
 * stored (security review 2026-11-06). Their sessions are seen to in the
 * route, where the store is.
 */
export const changeStaffPasswordWorkflow = createWorkflow(
  { name: "staff-change-password", store: false },
  (
    input: WorkflowData<{
      user_id: string
      auth_identity_id: string
      email: string
      sealed_password: string
    }>
  ) => {
    const sealed = transform({ input }, ({ input }) => ({
      user_id: input.user_id,
      email: input.email,
      sealed: input.sealed_password,
    }))
    checkNewPasswordStep(sealed)
    setPasswordStep(sealed)
    notePasswordChangedStep(input.auth_identity_id)
    tellAccountChangedStep(
      transform({ input }, ({ input }) => ({ user_id: input.user_id, change: "password" as const }))
    )
    return new WorkflowResponse(input.user_id)
  }
)
