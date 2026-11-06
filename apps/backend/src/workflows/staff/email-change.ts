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
import { sharedRateLimitStore } from "../../api/http/rate-limit"
import { parseKey } from "../../lib/crypto/pii"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { EMAIL_CHANGE_TTL_MS, openEmailChange, sealEmailChange } from "../../lib/staff/account"
import type { EmailChangeClaim } from "../../lib/staff/account"
import { recordAuditEntryStep } from "../audit-log/steps/record-audit-entry"
import { sendMessageWorkflow } from "../messaging/send-message"
import { provePasswordStep, tellAccountChanged, tellAccountChangedStep } from "./account-steps"

/**
 * A member's own login address (the owner, 2026-11-06): asked with the
 * current password, confirmed by a link sent to the new address (sealed,
 * a day, once), the old address told at both ends. Only the confirmation
 * moves the user and the login together, each undone if the other fails.
 */

type Container = Pick<MedusaContainer, "resolve">

const sealKey = () => parseKey(parseEnv().PII_ENCRYPTION_KEY, "PII_ENCRYPTION_KEY")
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Whether another person holds the address: a staff user, an open
 * invitation, or any login (a customer's too: one address, one login).
 * The answer is one word for all, so it tells nothing more.
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

const checkAddressStep = createStep(
  "staff-check-new-address",
  async (input: { user_id: string; from: string; to: string }, { container }) => {
    if (same(input.from, input.to)) {
      throw new ValidationError("staff.email_same", { field: "email" })
    }
    // Staff addresses: told now (the team list shows them anyway); a customer's stays unsaid
    const users = container.resolve(Modules.USER)
    const staff = await users.listUsers({ email: input.to }, { select: ["id"], take: 1 })
    const invited = await users.listInvites({ email: input.to }, { select: ["id"], take: 1 })
    if (staff.length > 0 || invited.length > 0) {
      throw new ValidationError("staff.email_unavailable", { field: "email" })
    }
    return new StepResponse(true)
  }
)

/** The link to the new address, the notice to the old one; a send that fails is logged. */
const sendLinkStep = createStep(
  "staff-send-email-change",
  async (input: { user_id: string; from: string; to: string }, { container }) => {
    const { token, claim } = sealEmailChange(input, sealKey())
    await sendMessageWorkflow(container)
      .run({
        input: {
          template: "staff.email_confirm",
          resource_id: input.user_id,
          key: claim.nonce,
          extra: { email: input.to, token },
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
    return new StepResponse({ expires_at: new Date(claim.expires_at).toISOString() })
  }
)

/** A new address asked for: the password proved, the address free, the link sent. */
export const requestStaffEmailChangeWorkflow = createWorkflow(
  "staff-request-email-change",
  (input: WorkflowData<{ user_id: string; email: string; current_password: string }>) => {
    const login = provePasswordStep({ user_id: input.user_id, password: input.current_password })
    const change = transform({ input, login }, ({ input, login }) => ({
      user_id: input.user_id,
      from: login.email,
      to: input.email,
    }))
    checkAddressStep(change)
    return new WorkflowResponse(sendLinkStep(change))
  }
)

/** Once a link is used it is spent, also when what follows fails: a new one is asked. */
async function spend(nonce: string): Promise<boolean> {
  const used = await sharedRateLimitStore().hit(`staff:email-change:${nonce}`, EMAIL_CHANGE_TTL_MS)
  return used.count === 1
}

/**
 * What a link changes: its claim, the user still at the address it was
 * asked from, the new address still free, the link not used before.
 */
export async function readEmailChange(
  container: Container,
  token: string,
  options: { key?: Buffer; spend?: (nonce: string) => Promise<boolean> } = {}
): Promise<EmailChangeClaim & { login_id: string }> {
  const claim = openEmailChange(token, options.key ?? sealKey())
  const invalid = () => new ValidationError("staff.email_change_invalid")
  if (!claim) {
    throw invalid()
  }
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers({ id: claim.user_id }, { select: ["email"], take: 1 })
  if (!user || !same(user.email, claim.from)) {
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
  if (!(await (options.spend ?? spend)(claim.nonce))) {
    throw invalid()
  }
  return { ...claim, from: user.email, login_id: login.id }
}

const readEmailChangeStep = createStep(
  "staff-read-email-change",
  async (token: string, { container }) => new StepResponse(await readEmailChange(container, token))
)

/** The login moved to the new address; undone, back to the old one. */
export async function moveLogin(
  container: Container,
  input: { login_id: string; to: string }
): Promise<void> {
  await container
    .resolve(Modules.AUTH)
    .updateProviderIdentities([{ id: input.login_id, entity_id: input.to }])
}

export const moveLoginStep = createStep(
  "staff-move-login",
  async (input: { login_id: string; from: string; to: string }, { container }) => {
    await moveLogin(container, input)
    return new StepResponse(true, { login_id: input.login_id, to: input.from })
  },
  async (undo: { login_id: string; to: string } | undefined, { container }) => {
    if (undo) {
      await moveLogin(container, undo)
    }
  }
)

/**
 * A link confirmed: the login and the user moved together (each undone if
 * the other fails), the change in the audit log (no addresses in it), the
 * old address told.
 */
export const confirmStaffEmailChangeWorkflow = createWorkflow(
  "staff-confirm-email-change",
  (input: WorkflowData<{ token: string }>) => {
    const claim = readEmailChangeStep(input.token)
    moveLoginStep(claim)
    updateUsersWorkflow.runAsStep({
      input: transform({ claim }, ({ claim }) => ({
        updates: [{ id: claim.user_id, email: claim.to }],
      })),
    })
    recordAuditEntryStep(
      transform({ claim }, ({ claim }) => ({
        kind: "mutation" as const,
        action: "POST /admin/staff/email/confirm",
        actor_type: "user",
        actor_id: claim.user_id,
        resource_type: "user",
        resource_id: claim.user_id,
        outcome: 200,
        changes: { fields: ["email"] },
      }))
    )
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
