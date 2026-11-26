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
 *    branch (20001); any failure withdraws the order, so nothing is left
 *    open at DHL; 20001 still unresolved tells staff to try again shortly.
 */

/** DHL answered and said no (its own code): nothing was opened. */
const refusedOutright = (error: unknown): boolean =>
  isProviderError(error) && error.providerCode.startsWith("error_")

/** Takes the order back at DHL after a later step failed; logged when DHL will not. */
async function withdraw(
  api: DhlEcomApi,
  credentials: DhlEcomCredentials,
  referenceId: string,
  orderDisplayId: number | string | null
) {
  await api.cancelOrder(credentials, referenceId).catch((cancel: unknown) => {
    logger.warn({
      event: "dhlecommerce.order_withdraw_failed",
      dhlReferenceId: referenceId,
      orderDisplayId,
      err: errorSummary(cancel),
    })
  })
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
