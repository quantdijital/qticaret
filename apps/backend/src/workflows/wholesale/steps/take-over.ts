import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../../lib/logging"
import type { EmailLogin, PasswordUndo } from "./login-password"
import { registerLogin, replacePasswords, restorePasswords, unlinkCustomer } from "./login-password"

/**
 * Staff taking over an address whose sign-up never proved it (ADR-0068 Ek
 * 2026-11-15 (2), case 3; security review M2, M5). The wholesaler must
 * inherit nothing the sign-up planted:
 * - every e-mail sign-in at the address, whatever its case, gets staff's
 *   password and ends its older tokens and sessions;
 * - all of them are unlinked from any customer; one (the sign-up's own,
 *   else the first) becomes the wholesaler's, the others stay unlinked;
 * - the sign-up's customer record is retired: made a guest record (no
 *   account), so its addresses, names, phone, consents, invoice identity
 *   and orders stay with it, and a fresh customer is opened for the
 *   wholesaler by the caller. Where the address already has a guest
 *   record (one guest per address), the retired record is soft-deleted
 *   instead; both are undone if a later step fails.
 */

type Container = Pick<MedusaContainer, "resolve">

export interface TakeOverUndo {
  passwords: PasswordUndo | null
  retired: { customer_id: string; how: "guest" | "deleted" } | null
}

/** The sign-up's customer record out of the way: a guest, or soft-deleted where one exists. */
async function retireCustomer(
  container: Container,
  customerId: string
): Promise<"guest" | "deleted"> {
  const customers = container.resolve(Modules.CUSTOMER)
  try {
    await customers.updateCustomers(customerId, { has_account: false } as never)
    return "guest"
  } catch (error) {
    // One guest record per address (Medusa's unique e-mail per `has_account`)
    logger.info({ event: "wholesale.take_over_soft_delete", err: errorSummary(error) })
    await customers.softDeleteCustomers([customerId])
    return "deleted"
  }
}

export async function undoTakeOver(container: Container, undo: TakeOverUndo): Promise<void> {
  if (undo.retired) {
    const customers = container.resolve(Modules.CUSTOMER)
    if (undo.retired.how === "deleted") {
      await customers.restoreCustomers([undo.retired.customer_id])
    } else {
      await customers.updateCustomers(undo.retired.customer_id, { has_account: true } as never)
    }
  }
  if (undo.passwords) {
    // Puts each identity's metadata back too: its link to the sign-up's customer
    await restorePasswords(container, undo.passwords)
  }
}

/**
 * The take-over: staff's password on every sign-in at the address, all
 * unlinked, the sign-up's record retired. Returns the sign-in the fresh
 * customer is made for (one it made, when the address had none).
 */
export async function takeOver(
  container: Container,
  input: {
    email: string
    sealed: string
    login: { customer_id: string | null; logins: EmailLogin[] }
  }
): Promise<{ identity_id: string; identity_made: string | null; undo: TakeOverUndo }> {
  const undo: TakeOverUndo = { passwords: null, retired: null }
  const { logins, customer_id: customerId } = input.login
  let made: string | null = null
  try {
    let identityId: string
    if (logins.length > 0) {
      undo.passwords = await replacePasswords(container, {
        logins,
        email: input.email,
        sealed: input.sealed,
      })
      const own = logins.find((login) => login.app_metadata["customer_id"] === customerId)
      identityId = (own ?? logins[0])?.identity_id ?? ""
      for (const login of logins) {
        await unlinkCustomer(container, login.identity_id)
      }
    } else {
      // A sign-up through another provider only: the wholesaler gets an e-mail sign-in of their own
      identityId = await registerLogin(container, input.email, input.sealed)
      made = identityId
    }
    if (customerId) {
      undo.retired = { customer_id: customerId, how: await retireCustomer(container, customerId) }
    }
    return { identity_id: identityId, identity_made: made, undo }
  } catch (error) {
    await undoTakeOver(container, undo)
      .then(() => (made ? container.resolve(Modules.AUTH).deleteAuthIdentities([made]) : undefined))
      .catch((undoError: unknown) => {
        logger.error({ event: "wholesale.take_over_undo_failed", err: errorSummary(undoError) })
      })
    throw error
  }
}
