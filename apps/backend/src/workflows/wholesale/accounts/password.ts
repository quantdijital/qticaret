import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ConflictError } from "../../../lib/errors"
import { normalizeEmail } from "../../../lib/wholesale"
import { checkAccountStep, accountById } from "../steps/account-rows"
import {
  emailLoginsAt,
  replacePasswords,
  restorePasswords,
  unlinkCustomer,
} from "../steps/login-password"
import type { EmailLogin } from "../steps/login-password"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The customer's e-mail sign-ins (review M2: every one at their address,
 * whatever its case), refused when one is a staff member's or another
 * customer's (review M3); null when none of them is the customer's own
 * (they sign in another way).
 */
export async function customerLogins(
  container: Container,
  customerId: string
): Promise<{ email: string; logins: EmailLogin[]; own: EmailLogin } | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: customerId },
  })
  const email = normalizeEmail((data[0] as { email?: string | null } | undefined)?.email ?? "")
  if (email === "") {
    return null
  }
  const logins = await emailLoginsAt(container, email)
  const linked = (login: EmailLogin) => login.app_metadata["customer_id"]
  if (
    logins.some(
      (login) =>
        typeof login.app_metadata["user_id"] === "string" ||
        (typeof linked(login) === "string" && linked(login) !== customerId)
    )
  ) {
    throw new ConflictError("wholesale.login_in_use")
  }
  const own = logins.find((login) => linked(login) === customerId)
  return own ? { email, logins, own } : null
}

/**
 * The bound customer's password replaced on every sign-in at the address,
 * older sign-ins ended, exactly one sign-in left tied to the customer
 * (review M2). Only for an account whose sign-in staff made or took over
 * (review M4): a customer who proved their own address keeps theirs.
 */
const setCustomerPasswordStep = createStep(
  "wholesale-set-customer-password",
  async (input: { id: string; sealed: string; email: string }, { container }) => {
    const account = await accountById(container, input.id)
    if (!account.staff_login) {
      throw new ConflictError("wholesale.password_own_login")
    }
    const found = account.customer_id ? await customerLogins(container, account.customer_id) : null
    if (!found) {
      throw new ConflictError("wholesale.no_password_login")
    }
    const undo = await replacePasswords(container, {
      logins: found.logins,
      email: input.email,
      sealed: input.sealed,
    })
    try {
      for (const login of found.logins) {
        if (login.identity_id !== found.own.identity_id && login.app_metadata["customer_id"]) {
          await unlinkCustomer(container, login.identity_id)
        }
      }
    } catch (error) {
      await restorePasswords(container, undo)
      throw error
    }
    return new StepResponse({ identity_id: found.own.identity_id }, undo)
  },
  async (undo, { container }) => {
    if (undo) {
      await restorePasswords(container, undo)
    }
  }
)

/**
 * A wholesaler's new password, typed by staff (ADR-0068 Ek 2026-11-15
 * (2)): there is no invitation mail to recover one, and the storefront's
 * own reset stays open to them. Only an open account whose sign-in staff
 * made or took over; the password, sealed for the request by the route
 * after the platform's rule, replaces the sign-in's and ends every older
 * sign-in. Kept out of the workflow store.
 */
export const setWholesalerPasswordWorkflow = createWorkflow(
  { name: "wholesale-set-password", store: false },
  (input: { id: string; email: string; sealed_password: string }) => {
    const lock = transform({ input }, ({ input }) => `wholesale-account:${input.id}`)
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
    checkAccountStep(
      transform({ input }, ({ input }) => ({ id: input.id, action: "password" as const }))
    )
    const set = setCustomerPasswordStep(
      transform({ input }, ({ input }) => ({
        id: input.id,
        sealed: input.sealed_password,
        email: input.email,
      }))
    )
    releaseLockStep({ key: lock })
    return new WorkflowResponse(
      transform({ input, set }, ({ input, set }) => ({ id: input.id, signed_out: !!set }))
    )
  }
)
