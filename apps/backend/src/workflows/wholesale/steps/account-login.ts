import type { ICartModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { likeLiteral } from "../../../lib/db/like"
import { errorSummary, logger } from "../../../lib/logging"
import { normalizeEmail, splitContactName } from "../../../lib/wholesale"
import { provenCustomer } from "../../account/proven-customer"
import {
  confirmAddress,
  dropConfirmations,
  registerLogin,
  replacePassword,
  restorePassword,
} from "./login-password"
import type { PasswordUndo } from "./login-password"

/**
 * Who signs in at a new wholesaler's address (ADR-0068 Ek 2026-11-15
 * (2)). Staff open the account with its password; the address decides
 * what that may do:
 * 1. no sign-in: a customer and its e-mail sign-in made, password set;
 * 2. a customer who proved the address: theirs, their own password kept;
 * 3. a sign-up that never proved it (someone may hold the address): refused
 *    unless staff take it over, which replaces the password, ends every
 *    older sign-in and sets its open carts aside;
 * a staff member's sign-in is never touched.
 */

type Container = Pick<MedusaContainer, "resolve">

export type AddressLogin =
  | { kind: "none" }
  | { kind: "proven"; customer_id: string }
  | { kind: "unproven"; customer_id: string | null; identity_id: string | null }
  | { kind: "staff" }

interface AuthRows {
  listProviderIdentities: (
    filters: Record<string, unknown>,
    config: { select: string[]; take: number }
  ) => Promise<{ auth_identity_id?: string | null }[]>
}

/** The e-mail sign-in at the address (any case), its identity's app metadata. */
async function emailLogin(container: Container, email: string) {
  const auth = container.resolve(Modules.AUTH)
  const [login] = await (auth as unknown as AuthRows).listProviderIdentities(
    { provider: "emailpass", entity_id: { $ilike: likeLiteral(email) } },
    { select: ["auth_identity_id"], take: 1 }
  )
  if (!login?.auth_identity_id) {
    return null
  }
  const identity = await auth.retrieveAuthIdentity(login.auth_identity_id)
  return { id: identity.id, app_metadata: identity.app_metadata ?? {} }
}

/** What signs in at the address now; read only. */
export async function addressLogin(container: Container, address: string): Promise<AddressLogin> {
  const email = normalizeEmail(address)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id"],
    filters: { email: { $ilike: likeLiteral(email) }, has_account: true },
  })
  const customerId = (data[0] as { id?: string } | undefined)?.id ?? null
  if (customerId && (await provenCustomer(container, customerId))) {
    return { kind: "proven", customer_id: customerId }
  }
  const login = await emailLogin(container, email)
  if (login && typeof login.app_metadata["user_id"] === "string") {
    return { kind: "staff" }
  }
  const linked = login?.app_metadata["customer_id"]
  if (customerId === null && login === null) {
    return { kind: "none" }
  }
  // A sign-in tied to another customer than the one at the address is no one's to take
  if (login && typeof linked === "string" && linked !== customerId) {
    return { kind: "staff" }
  }
  return { kind: "unproven", customer_id: customerId, identity_id: login?.id ?? null }
}

export interface EnsureLoginInput {
  email: string
  login: AddressLogin
  /** The password staff typed, sealed for the request; null when none was typed. */
  sealed_password: string | null
  /** Staff chose to take over an address with an unconfirmed sign-up. */
  take_over: boolean
  contact_name: string | null
  company_name: string | null
}

export type PasswordOutcome = "set" | "replaced" | "kept"

export interface LoginUndo {
  identity_made: string | null
  customer_made: string | null
  password: PasswordUndo | null
  linked_identity: { id: string; before: Record<string, unknown> } | null
  carts: string[]
  confirmations: string[]
}

/** The refusals before anything is written. */
function refusalOf(input: EnsureLoginInput): Error | null {
  if (input.login.kind === "staff") {
    return new ConflictError("wholesale.login_in_use")
  }
  if (input.login.kind === "unproven" && !input.take_over) {
    return new ConflictError("wholesale.unproven_signup")
  }
  if (input.login.kind !== "proven" && !input.sealed_password) {
    return new ValidationError("wholesale.password_required", { field: "password" })
  }
  return null
}

/** The customer's open carts set aside: one priced for the sign-up before must not go on. */
async function setCartsAside(container: Container, customerId: string): Promise<string[]> {
  const carts = container.resolve<ICartModuleService>(Modules.CART)
  const open = await carts.listCarts({ customer_id: customerId, completed_at: null } as never, {
    select: ["id"],
    take: null,
  })
  const ids = open.map((cart) => cart.id)
  if (ids.length > 0) {
    await carts.softDeleteCarts(ids)
  }
  return ids
}

async function makeCustomer(container: Container, input: EnsureLoginInput, identityId: string) {
  const { result } = await createCustomerAccountWorkflow(container as MedusaContainer).run({
    input: {
      authIdentityId: identityId,
      customerData: {
        email: normalizeEmail(input.email),
        ...splitContactName(input.contact_name),
        company_name: input.company_name,
      },
    },
  })
  return result.id
}

export async function undoLogin(container: Container, undo: LoginUndo) {
  const auth = container.resolve(Modules.AUTH)
  await dropConfirmations(container, undo.confirmations)
  if (undo.carts.length > 0) {
    await container.resolve<ICartModuleService>(Modules.CART).restoreCarts(undo.carts)
  }
  if (undo.customer_made) {
    await container.resolve(Modules.CUSTOMER).deleteCustomers([undo.customer_made])
  }
  if (undo.linked_identity) {
    await auth.updateAuthIdentities({
      id: undo.linked_identity.id,
      app_metadata: undo.linked_identity.before,
    })
  }
  if (undo.password) {
    await restorePassword(container, undo.password)
  }
  if (undo.identity_made) {
    await auth.deleteAuthIdentities([undo.identity_made])
  }
}

/**
 * The wholesaler's customer and sign-in as the address allows (above):
 * what was made, and what undoes it. A failure part-way undoes what it
 * made before throwing.
 */
export async function ensureLogin(
  container: Container,
  input: EnsureLoginInput
): Promise<{ result: { customer_id: string; password: PasswordOutcome }; undo: LoginUndo | null }> {
  const refusal = refusalOf(input)
  if (refusal) {
    throw refusal
  }
  const { login } = input
  if (login.kind === "proven") {
    return {
      result: { customer_id: login.customer_id, password: "kept" },
      undo: null,
    }
  }
  const email = normalizeEmail(input.email)
  const sealed = input.sealed_password ?? ""
  const undo: LoginUndo = {
    identity_made: null,
    customer_made: null,
    password: null,
    linked_identity: null,
    carts: [],
    confirmations: [],
  }
  try {
    let identityId: string
    let customerId: string | null = login.kind === "unproven" ? login.customer_id : null
    if (login.kind === "unproven" && login.identity_id) {
      identityId = login.identity_id
      undo.password = await replacePassword(container, { identity_id: identityId, email, sealed })
    } else {
      identityId = await registerLogin(container, email, sealed)
      undo.identity_made = identityId
    }
    if (customerId === null) {
      customerId = await makeCustomer(container, input, identityId)
      undo.customer_made = customerId
    } else if (!(login.kind === "unproven" && login.identity_id)) {
      // A customer without an e-mail sign-in: the new sign-in is theirs
      const auth = container.resolve(Modules.AUTH)
      const identity = await auth.retrieveAuthIdentity(identityId)
      undo.linked_identity = { id: identityId, before: identity.app_metadata ?? {} }
      await auth.updateAuthIdentities({
        id: identityId,
        app_metadata: { ...(identity.app_metadata ?? {}), customer_id: customerId },
      })
    }
    if (login.kind === "unproven" && login.customer_id) {
      undo.carts = await setCartsAside(container, login.customer_id)
    }
    undo.confirmations = await confirmAddress(container, identityId, email)
    return {
      result: {
        customer_id: customerId,
        password: login.kind === "unproven" ? "replaced" : "set",
      },
      undo,
    }
  } catch (error) {
    await undoLogin(container, undo).catch((undoError: unknown) => {
      logger.error({ event: "wholesale.login_undo_failed", err: errorSummary(undoError) })
    })
    throw error
  }
}

/** The step: every part made or changed is undone if a later step fails. */
export const ensureLoginStep = createStep(
  "wholesale-ensure-login",
  async (input: EnsureLoginInput, { container }) => {
    const { result, undo } = await ensureLogin(container, input)
    return new StepResponse(result, undo)
  },
  async (undo, { container }) => {
    if (undo) {
      await undoLogin(container, undo)
    }
  }
)
