import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ConflictError } from "../../../lib/errors"
import { likeLiteral } from "../../../lib/db/like"
import { normalizeEmail } from "../../../lib/wholesale"
import { checkAccountStep } from "../steps/account-rows"
import { replacePassword, restorePassword } from "../steps/login-password"

type Container = Pick<MedusaContainer, "resolve">

interface AuthRows {
  listProviderIdentities: (
    filters: Record<string, unknown>,
    config: { select: string[]; take: null }
  ) => Promise<{ auth_identity_id?: string | null }[]>
}

/**
 * The customer's e-mail sign-in: the identity of their address's
 * e-mail login that is tied to them; null when they sign in otherwise.
 */
export async function customerLogin(
  container: Container,
  customerId: string
): Promise<{ identity_id: string; email: string } | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: customerId },
  })
  const email = normalizeEmail((data[0] as { email?: string | null } | undefined)?.email ?? "")
  if (email === "") {
    return null
  }
  const auth = container.resolve(Modules.AUTH)
  const logins = await (auth as unknown as AuthRows).listProviderIdentities(
    { provider: "emailpass", entity_id: { $ilike: likeLiteral(email) } },
    { select: ["auth_identity_id"], take: null }
  )
  for (const login of logins) {
    if (login.auth_identity_id) {
      const identity = await auth.retrieveAuthIdentity(login.auth_identity_id)
      if (identity.app_metadata?.["customer_id"] === customerId) {
        return { identity_id: identity.id, email }
      }
    }
  }
  return null
}

/** The bound customer's password replaced; every older sign-in of theirs ends. */
const setCustomerPasswordStep = createStep(
  "wholesale-set-customer-password",
  async (input: { customer_id: string | null; sealed: string; email: string }, { container }) => {
    const login = input.customer_id ? await customerLogin(container, input.customer_id) : null
    if (!login) {
      throw new ConflictError("wholesale.no_password_login")
    }
    const undo = await replacePassword(container, {
      identity_id: login.identity_id,
      email: input.email,
      sealed: input.sealed,
    })
    return new StepResponse({ identity_id: login.identity_id }, undo)
  },
  async (undo, { container }) => {
    if (undo) {
      await restorePassword(container, undo)
    }
  }
)

/**
 * A wholesaler's new password, typed by staff (ADR-0068 Ek 2026-11-15
 * (2)): there is no invitation mail to recover one, and the storefront's
 * own reset stays open to them. The account must be bound (active or
 * closed); the password, sealed for the request by the route after the
 * platform's rule, replaces the sign-in's and ends every older sign-in.
 * Kept out of the workflow store.
 */
export const setWholesalerPasswordWorkflow = createWorkflow(
  { name: "wholesale-set-password", store: false },
  (input: { id: string; email: string; sealed_password: string }) => {
    const lock = transform({ input }, ({ input }) => `wholesale-account:${input.id}`)
    acquireLockStep({ key: lock, timeout: 5, ttl: 60 })
    const account = checkAccountStep(
      transform({ input }, ({ input }) => ({ id: input.id, action: "password" as const }))
    )
    const set = setCustomerPasswordStep(
      transform({ input, account }, ({ input, account }) => ({
        customer_id: account.customer_id,
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
