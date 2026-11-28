import { setTimeout as wait } from "node:timers/promises"
import { ValidationError, isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { trackingRefusal } from "../../lib/shipping/surat"
import type { SuratApi, SuratCredentials, SuratShipmentInput } from "../../lib/shipping/surat"

/**
 * Opening and taking back a Sürat parcel (docs/entegrasyonlar/surat.md),
 * only when staff press "Kargoya ver" (the receiver reaches Sürat no
 * earlier: KVKK, data minimisation). Sürat answers free text: anything but
 * a known success may still have opened the parcel, so it is deleted
 * before the failure is told; when Sürat will not delete it either, staff
 * are told to look at Sürat first, since a new try opens a second parcel
 * (security review 2026-11-26).
 */

/**
 * Sürat refused a malformed request (`soap:Client`): nothing was opened.
 * Any other fault (`soap:Server`, an exception that may come after the
 * parcel was written) is cleaned up like an unclear answer.
 */
const refusedRequest = (error: unknown): boolean =>
  isProviderError(error) && error.providerCode === "error_Client"

/** Sürat answered a sentence (no fault, no lost answer): it handled the call. */
const answered = (error: unknown): boolean =>
  isProviderError(error) && error.providerCode === "rejected"

/** Sürat's refusal says it has no such parcel. */
const absent = (error: unknown): boolean =>
  answered(error) &&
  isProviderError(error) &&
  trackingRefusal(error.providerMessage ?? null) === "not_found"

/** How long a lost create may still be opening the parcel at Sürat before a second delete. */
export const SURAT_SETTLE_MS = { value: 3_000 }

/**
 * Deletes what an unclear answer may have opened; refuses when Sürat
 * keeps a parcel. After a lost answer (`settle`) Sürat may still be
 * opening it: "not found" is asked once more after a pause.
 */
export async function takeBack(
  api: SuratApi,
  credentials: SuratCredentials,
  code: string,
  orderDisplayId: number | string | null,
  settle = false
): Promise<void> {
  try {
    try {
      await api.remove(credentials, code)
    } catch (error) {
      if (!absent(error) || !settle) {
        throw error
      }
      await wait(SURAT_SETTLE_MS.value)
      await api.remove(credentials, code)
    }
  } catch (error) {
    if (absent(error)) {
      return
    }
    logger.warn({
      event: "surat.shipment_withdraw_failed",
      suratCode: code,
      orderDisplayId,
      err: errorSummary(error),
    })
    throw new ValidationError("surat.withdraw_failed", { cause: error })
  }
}

/** Registers the parcel; any failure but a malformed request leaves nothing open at Sürat, or says so. */
export async function openSuratParcel(
  api: SuratApi,
  credentials: SuratCredentials,
  input: SuratShipmentInput,
  orderDisplayId: number | string | null
): Promise<void> {
  try {
    await api.createShipment(credentials, input)
  } catch (error) {
    if (!refusedRequest(error)) {
      // A sentence: Sürat finished the call; anything else (lost, a server fault) may still be opening
      await takeBack(api, credentials, input.code, orderDisplayId, !answered(error))
    }
    throw error
  }
}

// Sürat's words for a parcel the branch has handled already: it can only be asked back
const PROCESSED =
  /işlem görmüş|islem gormus|şubede|subede|kabul edilmiş|kabul edilmis|yolda|silinemez/i

/**
 * Cancels the parcel at Sürat: deleted while the branch has not taken it;
 * after that, asked back (`GonderiGeriCek`), and the fulfillment stays so
 * tracking follows it home (`surat.withdraw_requested`). "Not found" is
 * believed only when tracking does not know the parcel either; any other
 * refusal (a wrong login, a busy service) is told as it is, never turned
 * into a return request.
 */
export async function cancelSuratParcel(
  api: SuratApi,
  credentials: SuratCredentials,
  code: string
): Promise<void> {
  try {
    await api.remove(credentials, code)
    return
  } catch (error) {
    if (absent(error)) {
      if (!(await api.track(credentials, code)).found) {
        return
      }
    } else if (
      !answered(error) ||
      !isProviderError(error) ||
      !PROCESSED.test(error.providerMessage ?? "")
    ) {
      throw error
    }
  }
  await api.withdraw(credentials, code)
  throw new ValidationError("surat.withdraw_requested")
}
