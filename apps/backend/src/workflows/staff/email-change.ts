import { createHash } from "node:crypto"
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
import { errorSummary, logger } from "../../lib/logging"
import { EMAIL_CHANGE_TTL_MS, newEmailChange, parseEmailChange } from "../../lib/staff/account"
import type { EmailChangeClaim } from "../../lib/staff/account"
import { staffAccountStore } from "../../lib/staff/account-store"
import type { AccountStore } from "../../lib/staff/account-store"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { sendMessageWorkflow } from "../messaging/send-message"
import { tellAccountChanged, tellAccountChangedStep } from "./account-steps"

/**
 * A member's own login address (the owner, 2026-11-06; security review
 * 2026-11-06): asked with the current password (proved by the route), it
 * waits as the member's one pending change (a new ask replaces it, a
 * cancel drops it). A link goes to the new address, a notice to the old;
 * the member confirms it signed in. Only then do the user and the login
 * move together, each undone if the other fails. The token is made where
 * the e-mail is (its loader): no workflow carries it, none is stored.
 */

type Container = Pick<MedusaContainer, "resolve">

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The member's waiting change, or null. */
export async function pendingEmailChange(
  userId: string,
  store: AccountStore = staffAccountStore()
): Promise<EmailChangeClaim | null> {
  const claim = parseEmailChange(await store.getPending(userId))
  return claim && claim.expires_at > Date.now() ? claim : null
}

/** The waiting change dropped: its link opens nothing. */
export async function cancelEmailChange(
  userId: string,
  store: AccountStore = staffAccountStore()
): Promise<boolean> {
  const had = (await pendingEmailChange(userId, store)) !== null
  await store.clearPending(userId)
  return had
}

/**
 * Whether another person holds the address: a staff user, an open
 * invitation, or any login (a customer's too: one address, one login).
 * Asked only at confirmation, with one word for all.
 */
export async function addressInUse(
  container: Container,
  email: string,
  userId: string
): Promise<boolean> {
  const users = container.resolve(Modules.USER)
  const holders = await users.listUsers({ email }, { select: ["id"], take: 2 })
  if (holders.some((user) => user.id !== userId)) {
    return true
  }
  if ((await users.listInvites({ email }, { select: ["id"], take: 1 })).length > 0) {
    return true
  }
  const logins = await container
    .resolve(Modules.AUTH)
    .listProviderIdentities(
      { provider: "emailpass", entity_id: email },
      { select: ["id"], take: 1 }
    )
  return logins.length > 0
}

/**
 * The change waiting from now on, replacing any before it, the link to the
 * new address and the notice to the old one. Nothing is said about who
 * holds the new address: that waits for the confirmation.
 */
export async function askEmailChange(
  container: MedusaContainer,
  input: { user_id: string; from: string; to: string },
  store: AccountStore = staffAccountStore()
): Promise<EmailChangeClaim> {
  if (same(input.from, input.to)) {
    throw new ValidationError("staff.email_same", { field: "email" })
  }
  const claim = newEmailChange(input)
  await store.setPending(input.user_id, JSON.stringify(claim), EMAIL_CHANGE_TTL_MS)
  await sendMessageWorkflow(container)
    .run({
      input: {
        template: "staff.email_confirm",
        resource_id: input.user_id,
        // A new ask is a new send; the nonce itself goes nowhere
        key: createHash("sha256").update(claim.nonce).digest("hex").slice(0, 16),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "staff.email_confirm_failed", err: errorSummary(error) })
    })
  await tellAccountChanged(container, {
    user_id: input.user_id,
    change: "email_requested",
    email: input.from,
    to: input.to,
  })
  return claim
}

const askStep = createStep(
  "staff-ask-email-change",
  async (input: { user_id: string; from: string; to: string }, { container }) => {
    const claim = await askEmailChange(container, input)
    return new StepResponse({ expires_at: new Date(claim.expires_at).toISOString() })
  }
)

/** A new address asked for (the current password proved by the route). */
export const requestStaffEmailChangeWorkflow = createWorkflow(
  { name: "staff-request-email-change", store: false },
  (input: WorkflowData<{ user_id: string; from: string; to: string }>) =>
    new WorkflowResponse(askStep(input))
)

/**
 * What a confirmation changes. The link's claim must be the member's own
 * (signed in), their latest ask, still at the address it was asked from,
 * a member with a role, the new address free; then the waiting change is
 * taken, atomically: of two confirmations at once, one moves anything.
 */
export async function readEmailChange(
  container: Container,
  input: { user_id: string; claim: EmailChangeClaim },
  store: AccountStore = staffAccountStore()
): Promise<EmailChangeClaim & { login_id: string }> {
  const invalid = () => new ValidationError("staff.email_change_invalid")
  const { claim } = input
  if (claim.user_id !== input.user_id || claim.expires_at <= Date.now()) {
    throw invalid()
  }
  const stored = await store.getPending(claim.user_id)
  const pending = parseEmailChange(stored)
  if (!stored || pending?.nonce !== claim.nonce || !same(pending.to, claim.to)) {
    throw invalid()
  }
  const role = await container
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .roleOf(claim.user_id)
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers({ id: claim.user_id }, { select: ["email"], take: 1 })
  if (!role || !user || !same(user.email, claim.from)) {
    throw invalid()
  }
  const [login] = await container
    .resolve(Modules.AUTH)
    .listProviderIdentities(
      { provider: "emailpass", entity_id: user.email },
      { select: ["id"], take: 1 }
    )
  if (!login) {
    throw invalid()
  }
  if (await addressInUse(container, claim.to, claim.user_id)) {
    throw new ValidationError("staff.email_unavailable")
  }
  if (!(await store.takePending(claim.user_id, stored))) {
    throw invalid()
  }
  return { ...claim, from: user.email, login_id: login.id }
}

const readEmailChangeStep = createStep(
  "staff-read-email-change",
  async (input: { user_id: string; claim: EmailChangeClaim }, { container }) =>
    new StepResponse(await readEmailChange(container, input))
)

/**
 * The login moved to the new address, only from the address it was asked
 * from (a race lost leaves it alone); undone, back to the old one.
 */
export async function moveLogin(
  container: Container,
  input: { login_id: string; from: string; to: string }
): Promise<void> {
  const auth = container.resolve(Modules.AUTH)
  const [login] = await auth.listProviderIdentities(
    { id: [input.login_id] },
    { select: ["id", "entity_id"], take: 1 }
  )
  if (!login || !same(login.entity_id, input.from)) {
    throw new ValidationError("staff.email_change_invalid")
  }
  await auth.updateProviderIdentities([{ id: input.login_id, entity_id: input.to }])
}

export const moveLoginStep = createStep(
  "staff-move-login",
  async (input: { login_id: string; from: string; to: string }, { container }) => {
    await moveLogin(container, input)
    return new StepResponse(true, { login_id: input.login_id, from: input.to, to: input.from })
  },
  async (undo: { login_id: string; from: string; to: string } | undefined, { container }) => {
    if (undo) {
      await moveLogin(container, undo)
    }
  }
)

/**
 * A link confirmed by its member: the login and the user moved together
 * (each undone if the other fails), the old address told. The route
 * holds the member's lock around it and has opened the link.
 */
export const confirmStaffEmailChangeWorkflow = createWorkflow(
  { name: "staff-confirm-email-change", store: false },
  (input: WorkflowData<{ user_id: string; claim: EmailChangeClaim }>) => {
    const claim = readEmailChangeStep(input)
    moveLoginStep(claim)
    updateUsersWorkflow.runAsStep({
      input: transform({ claim }, ({ claim }) => ({
        updates: [{ id: claim.user_id, email: claim.to }],
      })),
    })
    tellAccountChangedStep(
      transform({ claim }, ({ claim }) => ({
        user_id: claim.user_id,
        change: "email_changed" as const,
        email: claim.from,
        to: claim.to,
      }))
    )
    return new WorkflowResponse(transform({ claim }, ({ claim }) => ({ user_id: claim.user_id })))
  }
)
