import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { forgetPasswordChange } from "../../../api/http/password-epoch-cache"
import { likeLiteral } from "../../../lib/db/like"
import { ConflictError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { openForRequest, sealForRequest } from "../../../lib/staff/account"
import { notePasswordChanged } from "../../staff/account-steps"

/**
 * A wholesaler's e-mail sign-ins as staff set them (ADR-0068 Ek
 * 2026-11-15 (2)): made with the password staff typed, or every sign-in
 * at the address given it; the time of the change kept on each identity,
 * a second ahead, so every older token and session is refused, one from
 * the same second too (`api/http/sign-in-epoch.ts`; review L6). The
 * password passes only sealed for the request (`sealForRequest`); the
 * hash it replaces is kept for the undo in the step's memory only (the
 * workflows run with `store: false`), never the password, and needs no
 * key that could expire before an undo (review L9).
 */

type Container = Pick<MedusaContainer, "resolve">

/** What binds a sealed password to the address it is for. */
export const passwordBinding = (email: string) => `wholesale.password:${email}`

/** A password sealed for this request, for the address it is set on. */
export const sealPassword = (email: string, password: string) =>
  sealForRequest(password, passwordBinding(email))

const openPassword = (email: string, sealed: string) =>
  openForRequest(sealed, passwordBinding(email))

// A staff-made change ends a sign-in of its own second as well
const STAFF_CHANGE_LEAD_MS = 1_000

/** An e-mail sign-in at the address: its row, its identity and that identity's metadata. */
export interface EmailLogin {
  provider_identity_id: string
  /** The address as that sign-in keeps it (its case may differ from the account's). */
  entity_id: string
  provider_metadata: Record<string, unknown>
  identity_id: string
  app_metadata: Record<string, unknown>
}

interface AuthRows {
  listProviderIdentities: (
    filters: Record<string, unknown>,
    config: { select: string[]; take: null }
  ) => Promise<
    {
      id: string
      entity_id: string
      auth_identity_id?: string | null
      provider_metadata?: Record<string, unknown> | null
    }[]
  >
}

/**
 * Every e-mail sign-in at the address, whatever the case it was typed in
 * (review M2: `Victim@x` and `victim@x` are two sign-ins of one address).
 */
export async function emailLoginsAt(container: Container, email: string): Promise<EmailLogin[]> {
  const auth = container.resolve(Modules.AUTH)
  const rows = await (auth as unknown as AuthRows).listProviderIdentities(
    { provider: "emailpass", entity_id: { $ilike: likeLiteral(email) } },
    { select: ["id", "entity_id", "auth_identity_id", "provider_metadata"], take: null }
  )
  const logins: EmailLogin[] = []
  for (const row of rows) {
    if (row.auth_identity_id) {
      const identity = await auth.retrieveAuthIdentity(row.auth_identity_id)
      logins.push({
        provider_identity_id: row.id,
        entity_id: row.entity_id,
        provider_metadata: row.provider_metadata ?? {},
        identity_id: identity.id,
        app_metadata: identity.app_metadata ?? {},
      })
    }
  }
  return logins
}

/**
 * The identity no longer tied to any customer: its customer id written
 * as null (an update keeps a key it does not name), its other metadata
 * kept. A sign-in with it opens no customer.
 */
export async function unlinkCustomer(container: Container, identityId: string): Promise<void> {
  const auth = container.resolve(Modules.AUTH)
  const identity = await auth.retrieveAuthIdentity(identityId)
  await auth.updateAuthIdentities({
    id: identityId,
    app_metadata: { ...(identity.app_metadata ?? {}), customer_id: null },
  })
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

/** What a replaced password undoes to: each sign-in's old hash and its identity's metadata. */
export interface PasswordUndo {
  logins: {
    provider_identity_id: string
    provider_metadata: Record<string, unknown>
    identity_id: string
    app_metadata: Record<string, unknown>
  }[]
}

/**
 * Every given sign-in's password replaced with the sealed one, and the
 * change noted on each identity (older sign-ins end). Returns the undo.
 */
export async function replacePasswords(
  container: Container,
  input: { logins: EmailLogin[]; email: string; sealed: string }
): Promise<PasswordUndo> {
  const auth = container.resolve(Modules.AUTH)
  const password = openPassword(input.email, input.sealed)
  const undo: PasswordUndo = { logins: [] }
  const at = new Date(Date.now() + STAFF_CHANGE_LEAD_MS)
  try {
    for (const login of input.logins) {
      const result = await auth.updateProvider("emailpass", {
        entity_id: login.entity_id,
        password,
      })
      if (!result.success) {
        throw new ConflictError("wholesale.login_not_made")
      }
      const before = await notePasswordChanged(container, login.identity_id, at)
      forgetPasswordChange(login.identity_id)
      undo.logins.push({
        provider_identity_id: login.provider_identity_id,
        provider_metadata: login.provider_metadata,
        identity_id: login.identity_id,
        app_metadata: before,
      })
    }
  } catch (error) {
    await restorePasswords(container, undo)
    throw error
  }
  return undo
}

/** The old hashes and metadata back: the passwords and their sign-ins as they were. */
export async function restorePasswords(container: Container, undo: PasswordUndo): Promise<void> {
  const auth = container.resolve(Modules.AUTH)
  for (const login of undo.logins) {
    try {
      await auth.updateProviderIdentities([
        { id: login.provider_identity_id, provider_metadata: login.provider_metadata },
      ])
      await auth.updateAuthIdentities({ id: login.identity_id, app_metadata: login.app_metadata })
      forgetPasswordChange(login.identity_id)
    } catch (error) {
      // Loud: the sign-in keeps the new password, its owner can still reset it from the storefront
      logger.error({
        event: "wholesale.password_undo_failed",
        identity_id: login.identity_id,
        err: errorSummary(error),
      })
    }
  }
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
