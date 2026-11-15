import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { forgetPasswordChange } from "../../../api/http/password-epoch-cache"
import { ConflictError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { openForRequest, sealForRequest } from "../../../lib/staff/account"
import { notePasswordChanged } from "../../staff/account-steps"

/**
 * A wholesaler's e-mail sign-in as staff set it (ADR-0068 Ek 2026-11-15
 * (2)): made with the password staff typed, or its password replaced; the
 * time of the change kept on the identity, so every older token and
 * session is refused (`api/http/sign-in-epoch.ts`). The password passes
 * only sealed for the request (`sealForRequest`), and the hash it
 * replaces is kept sealed for an undo: neither is ever stored or logged.
 */

type Container = Pick<MedusaContainer, "resolve">

/** What binds a sealed password to the address it is for. */
export const passwordBinding = (email: string) => `wholesale.password:${email}`
const undoBinding = (identityId: string) => `wholesale.password_undo:${identityId}`

/** A password sealed for this request, for the address it is set on. */
export const sealPassword = (email: string, password: string) =>
  sealForRequest(password, passwordBinding(email))

const openPassword = (email: string, sealed: string) =>
  openForRequest(sealed, passwordBinding(email))

/** What a replaced password undoes to: the old hash (sealed) and the identity's metadata. */
export interface PasswordUndo {
  identity_id: string
  provider_identity_id: string
  sealed_metadata: string
  app_metadata: Record<string, unknown>
}

/** A new e-mail sign-in for the address with the sealed password; its identity's id. */
export async function registerLogin(
  container: Container,
  email: string,
  sealed: string
): Promise<string> {
  const result = await container.resolve(Modules.AUTH).register("emailpass", {
    body: { email, password: openPassword(email, sealed) },
  })
  if (!result.success || !result.authIdentity) {
    // The provider's words may name the address: neither logged nor answered
    logger.warn({ event: "wholesale.login_not_made" })
    throw new ConflictError("wholesale.login_not_made")
  }
  return result.authIdentity.id
}

/** The identity's e-mail sign-in: its row and the address it signs in with. */
export async function emailLoginOf(container: Container, identityId: string) {
  const [login] = await container
    .resolve(Modules.AUTH)
    .listProviderIdentities(
      { auth_identity_id: identityId, provider: "emailpass" },
      { select: ["id", "entity_id", "provider_metadata"], take: 1 }
    )
  return login ?? null
}

/**
 * The identity's password replaced with the sealed one, and the change
 * noted (older sign-ins end). Returns what puts the old hash back.
 */
export async function replacePassword(
  container: Container,
  input: { identity_id: string; email: string; sealed: string }
): Promise<PasswordUndo> {
  const login = await emailLoginOf(container, input.identity_id)
  if (!login) {
    throw new ConflictError("wholesale.no_password_login")
  }
  const auth = container.resolve(Modules.AUTH)
  const result = await auth.updateProvider("emailpass", {
    entity_id: login.entity_id,
    password: openPassword(input.email, input.sealed),
  })
  if (!result.success) {
    throw new ConflictError("wholesale.login_not_made")
  }
  const before = await notePasswordChanged(container, input.identity_id)
  forgetPasswordChange(input.identity_id)
  return {
    identity_id: input.identity_id,
    provider_identity_id: login.id,
    sealed_metadata: sealForRequest(
      JSON.stringify(login.provider_metadata ?? {}),
      undoBinding(input.identity_id)
    ),
    app_metadata: before,
  }
}

/** The old hash and metadata back: the password and its sign-ins as they were. */
export async function restorePassword(container: Container, undo: PasswordUndo): Promise<void> {
  const auth = container.resolve(Modules.AUTH)
  const metadata = JSON.parse(
    openForRequest(undo.sealed_metadata, undoBinding(undo.identity_id))
  ) as Record<string, unknown>
  await auth.updateProviderIdentities([
    { id: undo.provider_identity_id, provider_metadata: metadata },
  ])
  await auth.updateAuthIdentities({ id: undo.identity_id, app_metadata: undo.app_metadata })
  forgetPasswordChange(undo.identity_id)
}

interface VerificationRows {
  listAuthVerifications: (
    filters: Record<string, unknown>,
    config: { select: string[]; take: null }
  ) => Promise<{ id: string; verified_at: Date | string | null }[]>
  requestAuthVerification: (input: Record<string, unknown>) => Promise<{ code?: string | null }>
  confirmAuthVerification: (input: { code: string }) => Promise<unknown>
  deleteAuthVerifications?: (ids: string[]) => Promise<void>
}

/**
 * The address confirmed for the identity (what proves a customer owns it,
 * `provenCustomer`): staff opened the account, so staff vouch for it
 * instead of a mailed code. Returns the confirmations it made, for an undo.
 */
export async function confirmAddress(
  container: Container,
  identityId: string,
  email: string
): Promise<string[]> {
  const auth = container.resolve(Modules.AUTH) as unknown as VerificationRows
  const filters = { entity_type: "email", entity_id: email, auth_identity_id: identityId }
  const before = await auth.listAuthVerifications(filters, {
    select: ["id", "verified_at"],
    take: null,
  })
  if (before.some((row) => row.verified_at !== null)) {
    return []
  }
  const { code } = await auth.requestAuthVerification({ ...filters, code_provider: "token" })
  if (!code) {
    throw new ConflictError("wholesale.login_not_made")
  }
  await auth.confirmAuthVerification({ code })
  const after = await auth.listAuthVerifications(filters, { select: ["id"], take: null })
  const known = new Set(before.map((row) => row.id))
  return after.map((row) => row.id).filter((id) => !known.has(id))
}

/** The confirmations made taken back; a failure is logged, the rest of the undo goes on. */
export async function dropConfirmations(container: Container, ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return
  }
  const auth = container.resolve(Modules.AUTH) as unknown as VerificationRows
  await auth.deleteAuthVerifications?.(ids).catch((error: unknown) => {
    logger.warn({ event: "wholesale.confirmation_undo_failed", err: errorSummary(error) })
  })
}
