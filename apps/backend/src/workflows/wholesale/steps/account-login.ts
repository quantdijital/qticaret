import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { likeLiteral } from "../../../lib/db/like"
import { errorSummary, logger } from "../../../lib/logging"
import { normalizeEmail, splitContactName } from "../../../lib/wholesale"
import { provenCustomer } from "../../account/proven-customer"
import { confirmAddress, dropConfirmations, emailLoginsAt, registerLogin } from "./login-password"
import type { EmailLogin } from "./login-password"
import { takeOver, undoTakeOver } from "./take-over"
import type { TakeOverUndo } from "./take-over"

/**
 * Who signs in at a new wholesaler's address (ADR-0068 Ek 2026-11-15
 * (2)). Staff open the account with its password; the address decides
 * what that may do:
 * 1. no sign-in: a customer and its e-mail sign-in made, password set;
 * 2. a customer who proved the address: theirs, their own password kept;
 * 3. a sign-up that never proved it (someone may hold the address): refused
 *    unless staff take it over (`take-over.ts`): every sign-in at the
 *    address gets staff's password and ends its older sign-ins, the
 *    sign-up's customer record is retired and a fresh one opened;
 * a staff member's sign-in, or one tied to another customer, is never
 * touched (checked before anything else, review M3).
 */

type Container = Pick<MedusaContainer, "resolve">

export type AddressLogin =
  | { kind: "none" }
  | { kind: "proven"; customer_id: string }
  | { kind: "unproven"; customer_id: string | null; logins: EmailLogin[] }
  | { kind: "staff" }

const linkedCustomer = (login: EmailLogin) => {
  const id = login.app_metadata["customer_id"]
  return typeof id === "string" ? id : null
}

/** What signs in at the address now; read only. */
export async function addressLogin(container: Container, address: string): Promise<AddressLogin> {
  const email = normalizeEmail(address)
  const logins = await emailLoginsAt(container, email)
  // A staff member's sign-in, whatever else the identity holds: never ours (review M3)
  if (logins.some((login) => typeof login.app_metadata["user_id"] === "string")) {
    return { kind: "staff" }
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id"],
    filters: { email: { $ilike: likeLiteral(email) }, has_account: true },
  })
  const customerId = (data[0] as { id?: string } | undefined)?.id ?? null
  if (customerId && (await provenCustomer(container, customerId))) {
    return { kind: "proven", customer_id: customerId }
  }
  // A sign-in tied to another customer than the one at the address is no one's to take
  if (
    logins.some((login) => linkedCustomer(login) !== null && linkedCustomer(login) !== customerId)
  ) {
    return { kind: "staff" }
  }
  if (customerId === null && logins.length === 0) {
    return { kind: "none" }
  }
  return { kind: "unproven", customer_id: customerId, logins }
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
  take_over: TakeOverUndo | null
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

/** A new customer record for the sign-in, with the account's names. */
export async function makeCustomer(
  container: Container,
  input: Pick<EnsureLoginInput, "email" | "contact_name" | "company_name">,
  identityId: string
): Promise<string> {
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
  await dropConfirmations(container, undo.confirmations)
  if (undo.customer_made) {
    await container.resolve(Modules.CUSTOMER).deleteCustomers([undo.customer_made])
  }
  if (undo.take_over) {
    await undoTakeOver(container, undo.take_over)
  }
  if (undo.identity_made) {
    await container.resolve(Modules.AUTH).deleteAuthIdentities([undo.identity_made])
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
    return { result: { customer_id: login.customer_id, password: "kept" }, undo: null }
  }
  const email = normalizeEmail(input.email)
  const sealed = input.sealed_password ?? ""
  const undo: LoginUndo = {
    identity_made: null,
    customer_made: null,
    take_over: null,
    confirmations: [],
  }
  try {
    let identityId: string
    let customerId: string
    if (login.kind === "unproven") {
      const taken = await takeOver(container, {
        email,
        sealed,
        login,
        customer: {
          email,
          ...splitContactName(input.contact_name),
          company_name: input.company_name,
        },
      })
      undo.take_over = taken.undo
      undo.identity_made = taken.identity_made
      identityId = taken.identity_id
      customerId = taken.customer_id
    } else {
      identityId = await registerLogin(container, email, sealed)
      undo.identity_made = identityId
      customerId = await makeCustomer(container, input, identityId)
      undo.customer_made = customerId
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
