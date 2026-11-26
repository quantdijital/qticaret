import { ValidationError, isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { refusalOf } from "../../lib/shipping/ptt"
import type { PttApi, PttCredentials, PttShipmentInput } from "../../lib/shipping/ptt"

/**
 * Opening and deleting a PTT parcel (docs/entegrasyonlar/ptt.md), only
 * when staff press "Kargoya ver" (the receiver reaches PTT no earlier:
 * KVKK, data minimisation). PTT answers a code: its refusal loaded
 * nothing. Any other failure (a lost answer, a server fault) may still
 * have loaded the parcel, so it is deleted before the failure is told;
 * when PTT will not delete it either, staff are told to look at PTT first.
 * The barcode is never handed out again either way.
 */

/** PTT answered the call with its code (`hataKodu` ≠ 1): it handled it. */
const answered = (error: unknown): boolean =>
  isProviderError(error) &&
  (error.providerCode === "rejected" || error.providerCode.startsWith("ptt_"))

/** PTT's refusal says it has no such barcode. */
const absent = (error: unknown): boolean =>
  answered(error) &&
  isProviderError(error) &&
  refusalOf(error.providerMessage ?? null) === "not_found"

/** Deletes what an unclear answer may have loaded; refuses when PTT keeps it. */
export async function takeBack(
  api: PttApi,
  credentials: PttCredentials,
  barcode: string,
  fileName: string,
  orderDisplayId: number | string | null
): Promise<void> {
  try {
    await api.remove(credentials, barcode, fileName)
  } catch (error) {
    if (absent(error)) {
      return
    }
    logger.warn({
      event: "ptt.shipment_withdraw_failed",
      pttBarcode: barcode,
      orderDisplayId,
      err: errorSummary(error),
    })
    throw new ValidationError("ptt.withdraw_failed", { cause: error })
  }
}

/** Loads the parcel; any failure but PTT's own refusal leaves nothing loaded, or says so. */
export async function openPttParcel(
  api: PttApi,
  credentials: PttCredentials,
  input: PttShipmentInput,
  fileName: string,
  orderDisplayId: number | string | null
): Promise<void> {
  try {
    await api.upload(credentials, input, fileName)
  } catch (error) {
    // Our own check (a name too short) sent nothing; PTT's refusal loaded nothing
    if (isProviderError(error) && !answered(error)) {
      await takeBack(api, credentials, input.barcode, fileName, orderDisplayId)
    }
    throw error
  }
}

/**
 * Deletes the parcel at PTT while no branch has accepted it. Once one has,
 * PTT refuses: the fulfillment stays, tracking follows it, and staff are
 * told it is cancelled at a PTT branch (`ptt.already_accepted`). A refusal
 * saying PTT has no such parcel is believed only when tracking does not
 * know it either.
 */
export async function cancelPttParcel(
  api: PttApi,
  credentials: PttCredentials,
  barcode: string,
  fileName: string | null
): Promise<void> {
  try {
    if (!fileName) {
      throw new ValidationError("ptt.already_accepted")
    }
    await api.remove(credentials, barcode, fileName)
  } catch (error) {
    if (isProviderError(error) && !answered(error)) {
      throw error
    }
    if ((await api.track(credentials, barcode)).found) {
      throw new ValidationError("ptt.already_accepted", { cause: error })
    }
    if (!absent(error)) {
      throw error
    }
  }
}
