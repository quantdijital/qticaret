import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { newPasswordProblem } from "../../api/http/password-policy"
import { PASSWORD_CHANGED_AT } from "../../api/http/password-change"
import { ValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { sendMessageWorkflow } from "../messaging/send-message"

/**
 * The steps of a staff member's own account (the owner, 2026-11-06): the
 * password they know proved, the new one set, the time of the change kept
 * for the tokens before it. Each part is a plain function for its tests.
 */

type Container = Pick<MedusaContainer, "resolve">

/** The user's login address, and that the password given is theirs; else `staff.password_wrong`. */
export async function provePassword(
  container: Container,
  input: { user_id: string; password: string }
): Promise<{ email: string; auth_identity_id: string }> {
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers({ id: input.user_id }, { select: ["email"], take: 1 })
  if (!user) {
    throw new ValidationError("staff.password_wrong", { field: "current_password" })
  }
  const result = await container
    .resolve(Modules.AUTH)
    .authenticate("emailpass", { body: { email: user.email, password: input.password } })
    .catch(() => null)
  // With 2FA on, the right password is answered with the second step's challenge
  const identity = result?.success
    ? result.authIdentity?.id
    : result?.mfaChallenge?.auth_identity_id
  if (!identity) {
    throw new ValidationError("staff.password_wrong", { field: "current_password" })
  }
  return { email: user.email, auth_identity_id: identity }
}

/** The current password, proved: the step every own-account change starts with. */
export const provePasswordStep = createStep(
  "staff-prove-password",
  async (input: { user_id: string; password: string }, { container }) =>
    new StepResponse(await provePassword(container, input))
)

/** The new password by the platform's rule (adr/0043); not the one it replaces. */
export async function checkNewPassword(input: {
  email: string
  current: string
  next: string
}): Promise<void> {
  const problem = await newPasswordProblem(input.next, input.email)
  if (problem) {
    throw new ValidationError(problem, { field: "new_password" })
  }
  if (input.next === input.current) {
    throw new ValidationError("staff.password_same", { field: "new_password" })
  }
}

export const checkNewPasswordStep = createStep(
  "staff-check-new-password",
  async (input: { email: string; current: string; next: string }) => {
    await checkNewPassword(input)
    return new StepResponse(true)
  }
)

/** What setting the password undoes to: the login's stored hash before it. */
export interface PasswordUndo {
  provider_identity_id: string
  provider_metadata: Record<string, unknown> | null
}

/** The new password on the login; returns what restores the old one. */
export async function setPassword(
  container: Container,
  input: { email: string; password: string }
): Promise<PasswordUndo> {
  const auth = container.resolve(Modules.AUTH)
  const [login] = await auth.listProviderIdentities(
    { provider: "emailpass", entity_id: input.email },
    { select: ["id", "provider_metadata"], take: 1 }
  )
  if (!login) {
    throw new ValidationError("staff.password_wrong", { field: "current_password" })
  }
  const result = await auth.updateProvider("emailpass", {
    entity_id: input.email,
    password: input.password,
  })
  if (!result.success) {
    throw new Error("staff.password_not_set")
  }
  return { provider_identity_id: login.id, provider_metadata: login.provider_metadata ?? null }
}

/** The old hash back on the login: the password as it was. */
export async function restorePassword(container: Container, undo: PasswordUndo): Promise<void> {
  await container.resolve(Modules.AUTH).updateProviderIdentities([
    {
      id: undo.provider_identity_id,
      provider_metadata: undo.provider_metadata ?? {},
    },
  ])
}

export const setPasswordStep = createStep(
  "staff-set-password",
  async (input: { email: string; password: string }, { container }) =>
    new StepResponse(true, await setPassword(container, input)),
  async (undo: PasswordUndo | undefined, { container }) => {
    if (undo) {
      await restorePassword(container, undo)
    }
  }
)

/**
 * When the password changed, on the identity (api/http/password-change.ts):
 * a token from before it is neither refreshed nor turned into a session.
 * Returns the metadata it replaced.
 */
export async function notePasswordChanged(
  container: Container,
  identityId: string,
  at: Date = new Date()
): Promise<Record<string, unknown>> {
  const auth = container.resolve(Modules.AUTH)
  const identity = await auth.retrieveAuthIdentity(identityId)
  const before = identity.app_metadata ?? {}
  await auth.updateAuthIdentities({
    id: identityId,
    app_metadata: { ...before, [PASSWORD_CHANGED_AT]: at.toISOString() },
  })
  return before
}

export const notePasswordChangedStep = createStep(
  "staff-note-password-changed",
  async (identityId: string, { container }) => {
    const before = await notePasswordChanged(container, identityId)
    return new StepResponse(true, { identityId, before })
  },
  async (
    undo: { identityId: string; before: Record<string, unknown> } | undefined,
    { container }
  ) => {
    if (undo) {
      await container
        .resolve(Modules.AUTH)
        .updateAuthIdentities({ id: undo.identityId, app_metadata: undo.before })
    }
  }
)

/** What a notice about the account says, and where it goes. */
export interface AccountNotice {
  user_id: string
  change: "password" | "email_requested" | "email_changed"
  /** The address it goes to; the login's own when unset. */
  email?: string
  /** The new address, for an address change. */
  to?: string
}

/** Tells the member; a send that fails is logged, the change stands. */
export async function tellAccountChanged(container: MedusaContainer, notice: AccountNotice) {
  await sendMessageWorkflow(container)
    .run({
      input: {
        template: "staff.account_changed",
        resource_id: notice.user_id,
        key: `${notice.change}:${String(Date.now())}`,
        extra: {
          change: notice.change,
          ...(notice.email ? { email: notice.email } : {}),
          ...(notice.to ? { to: notice.to } : {}),
        },
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "staff.account_notice_failed", err: errorSummary(error) })
    })
}

/** The notice, last: nothing after it can fail and undo a change already told. */
export const tellAccountChangedStep = createStep(
  "staff-tell-account-changed",
  async (notice: AccountNotice, { container }) => {
    await tellAccountChanged(container, notice)
    return new StepResponse(true)
  }
)
