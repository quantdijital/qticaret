import { ValidationError, isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { DHL_CODES } from "../../lib/shipping/dhlecommerce"
import type {
  DhlEcomApi,
  DhlEcomBarcode,
  DhlEcomCredentials,
  DhlEcomShipmentInput,
} from "../../lib/shipping/dhlecommerce"

/**
 * Opening a DHL eCommerce parcel (docs/entegrasyonlar/dhlecommerce.md), in
 * the three steps DHL asks for, only when staff press "Kargoya ver" (the
 * receiver reaches DHL no earlier: KVKK, data minimisation):
 * 1. `createRecipient`, so DHL finds the receiver's branch;
 * 2. `createOrder`; a refusal opened nothing, an answer that never came
 *    may have: withdrawn;
 * 3. `createbarcode`, waiting a little while DHL still looks for the
 *    branch (20001); any failure withdraws what DHL made (barcode, then
 *    order), so nothing is left open at DHL; 20001 still unresolved tells
 *    staff to try again shortly. A withdrawal DHL refuses tells staff to
 *    check DHL first (`dhlecommerce.withdraw_failed`).
 */

/** DHL answered and said no (its own code): nothing was opened. */
const refusedOutright = (error: unknown): boolean =>
  isProviderError(error) && error.providerCode.startsWith("error_")

/**
 * Takes the parcel back at DHL after a later step failed, whatever DHL
 * made of it: asked first (a barcode may have been made though its answer
 * never came), its barcode withdrawn when it has one, then its order.
 * Nothing at DHL under the reference: nothing to take back. When DHL will
 * not take it back, staff are told to look at DHL before shipping again,
 * since a new try opens a second parcel (security review 2026-11-26).
 */
async function withdraw(
  api: DhlEcomApi,
  credentials: DhlEcomCredentials,
  referenceId: string,
  orderDisplayId: number | string | null
) {
  try {
    const now = await api.status(credentials, referenceId)
    if (!now.found) {
      return
    }
    await withdrawDhlEcomParcel(api, credentials, referenceId, now.shipmentId)
  } catch (cancel) {
    logger.warn({
      event: "dhlecommerce.order_withdraw_failed",
      dhlReferenceId: referenceId,
      orderDisplayId,
      err: errorSummary(cancel),
    })
    throw new ValidationError("dhlecommerce.withdraw_failed", { cause: cancel })
  }
}

export async function openDhlEcomParcel(
  api: DhlEcomApi,
  credentials: DhlEcomCredentials,
  input: DhlEcomShipmentInput,
  orderDisplayId: number | string | null
): Promise<DhlEcomBarcode> {
  await api.createRecipient(credentials, input)
  try {
    await api.createOrder(credentials, input)
  } catch (error) {
    if (!refusedOutright(error)) {
      await withdraw(api, credentials, input.referenceId, orderDisplayId)
    }
    throw error
  }
  try {
    return await api.createBarcode(credentials, input)
  } catch (error) {
    await withdraw(api, credentials, input.referenceId, orderDisplayId)
    if (isProviderError(error) && error.providerCode === DHL_CODES.branchNotFound) {
      throw new ValidationError("dhlecommerce.branch_pending", { cause: error })
    }
    throw error
  }
}

/** Takes a parcel back: its barcode first, then its order. */
export async function withdrawDhlEcomParcel(
  api: DhlEcomApi,
  credentials: DhlEcomCredentials,
  referenceId: string,
  shipmentId: string | null
) {
  if (shipmentId) {
    await api.cancelShipment(credentials, referenceId, shipmentId)
  }
  await api.cancelOrder(credentials, referenceId)
}
