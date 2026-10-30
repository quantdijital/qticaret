import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"

type Container = Pick<MedusaContainer, "resolve">

// A shop's staff are a handful; its enabled factors fit one read
const MAX_FACTORS = 10_000

/** The logins (auth identities) of staff addresses, by address in lower case: one read each. */
async function loginsOf(container: Container, emails: readonly string[]) {
  const auth = container.resolve(Modules.AUTH)
  const found = await Promise.all(
    emails.map(async (email) => {
      const [login] = await auth.listProviderIdentities(
        { provider: "emailpass", entity_id: email },
        { select: ["auth_identity_id"], take: 1 }
      )
      return login?.auth_identity_id
        ? ([email.toLowerCase(), login.auth_identity_id] as const)
        : null
    })
  )
  return new Map(found.filter((entry) => entry !== null))
}

/** Which of these addresses have 2FA on: an enabled factor on their login (adr/0040 §2). */
export async function mfaOnFor(
  container: Container,
  emails: readonly string[]
): Promise<Set<string>> {
  const logins = await loginsOf(container, emails)
  if (logins.size === 0) {
    return new Set()
  }
  const factors = await container
    .resolve(Modules.AUTH)
    .listAuthMfa({ status: "enabled" }, { select: ["auth_identity_id"], take: MAX_FACTORS })
  const on = new Set(factors.map((factor) => factor.auth_identity_id))
  return new Set([...logins].filter(([, identity]) => on.has(identity)).map(([email]) => email))
}

/**
 * A member's 2FA turned off: their enabled and half-done factors. Nothing
 * to undo: the member sets 2FA up again at their next sign-in when the
 * shop requires it.
 */
const turnOffFactorsStep = createStep(
  "staff-turn-off-factors",
  async (email: string, { container }) => {
    const identity = (await loginsOf(container, [email])).get(email.toLowerCase())
    if (!identity) {
      return new StepResponse(0)
    }
    const auth = container.resolve(Modules.AUTH)
    const factors = await auth.listAuthMfa(
      { auth_identity_id: identity, status: ["enabled", "pending"] },
      { select: ["id"] }
    )
    for (const factor of factors) {
      await auth.disableAuthMfa({ id: factor.id })
    }
    return new StepResponse(factors.length)
  }
)

/** The owner turns a member's 2FA off: a phone lost, no recovery code left (F12.6, adr/0040). */
export const resetStaffMfaWorkflow = createWorkflow(
  "staff-reset-mfa",
  (input: WorkflowData<{ email: string }>) => new WorkflowResponse(turnOffFactorsStep(input.email))
)
