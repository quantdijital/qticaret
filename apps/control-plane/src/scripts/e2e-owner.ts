import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { parseEnv } from "../lib/env"
import { localOnlyProblem } from "../lib/local-only"
import { loginOf } from "../lib/staff/mfa"
import { sessionIndex } from "../lib/staff/session-index"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { CP_STAFF_MODULE } from "../modules/cp-staff"
import type CpStaffModuleService from "../modules/cp-staff/service"

/**
 * The control plane panel's e2e owner (apps/control-plane-panel/e2e, adr/0061
 * Ek C6): a temporary owner for one run, made and removed from the server's
 * shell like the shop panel's e2e admin. Only on a developer's machine or in
 * a test run, and only for the address shape the e2e setup makes, so no
 * real account is ever touched. The owner has no 2FA yet: the run sets it up
 * through the panel's own setup page, as a person would.
 */

export const E2E_OWNER_EMAIL = /^cp-e2e-\d{13}-[0-9a-f]{6}@example\.com$/

export class E2eOwnerError extends Error {
  override readonly name = "E2eOwnerError"
}

export function checkE2eAddress(email: string, env = parseEnv()): void {
  const problem = localOnlyProblem(env)
  if (problem) {
    throw new E2eOwnerError(`e2e-owner: ${problem}`)
  }
  if (!E2E_OWNER_EMAIL.test(email)) {
    throw new E2eOwnerError("e2e-owner: not an e2e owner address")
  }
}

/** A login, a user and the owner role for the address. */
export async function makeE2eOwner(
  container: MedusaContainer,
  email: string,
  password: string
): Promise<string> {
  checkE2eAddress(email)
  if (password.length < 16) {
    throw new E2eOwnerError("e2e-owner: the run's password is too short")
  }
  const made = await container
    .resolve(Modules.AUTH)
    .register("emailpass", { body: { email, password } })
  if (!made.success || !made.authIdentity) {
    throw new E2eOwnerError("e2e-owner: the login was not made")
  }
  const { result: user } = await createUserAccountWorkflow(container).run({
    input: { authIdentityId: made.authIdentity.id, userData: { email } },
  })
  await container.resolve<CpStaffModuleService>(CP_STAFF_MODULE).setRole(user.id, "owner", null)
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action: "cp_staff.e2e_owner_made",
    actor_type: "system",
    resource_type: "cp_staff_member",
    resource_id: user.id,
  })
  return user.id
}

/** The run's owner gone: sessions, role, login and user. Its audit rows stay (append-only). */
export async function removeE2eOwner(container: MedusaContainer, email: string): Promise<boolean> {
  checkE2eAddress(email)
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers({ email }, { select: ["id"], take: 1 })
  const login = await loginOf(container, email)
  if (user) {
    await sessionIndex().clear(user.id)
    await container.resolve<CpStaffModuleService>(CP_STAFF_MODULE).removeMember(user.id)
    await container.resolve(Modules.USER).deleteUsers([user.id])
  }
  if (login) {
    await container.resolve(Modules.AUTH).deleteAuthIdentities([login])
  }
  return Boolean(user ?? login)
}

/**
 * `NODE_ENV=development medusa exec ./src/scripts/e2e-owner.ts make <email> <password>`
 * or `… remove <email>`. Prints nothing about the account.
 */
export default async function e2eOwner({ container, args }: ExecArgs) {
  const [action = "", email = "", password = ""] = args
  if (action === "make") {
    await makeE2eOwner(container, email, password)
  } else if (action === "remove") {
    await removeE2eOwner(container, email)
  } else {
    throw new E2eOwnerError("e2e-owner: make <email> <password> | remove <email>")
  }
  process.stdout.write(`e2e-owner: ${action} done\n`)
}
