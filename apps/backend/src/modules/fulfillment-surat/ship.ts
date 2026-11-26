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
 * are told to look at Sürat first, since a new try opens a second parcel.
 */

/** A SOAP fault: Sürat's service refused the call outright, nothing was opened. */
const faulted = (error: unknown): boolean =>
  isProviderError(error) && error.providerCode.startsWith("error_")

/** Sürat's refusal says it has no such parcel: there is nothing to take back. */
const absent = (error: unknown): boolean =>
  isProviderError(error) &&
  error.providerCode === "rejected" &&
  trackingRefusal(error.providerMessage ?? null) === "not_found"

/** Deletes what an unclear answer may have opened; refuses when Sürat keeps a parcel. */
export async function takeBack(
  api: SuratApi,
  credentials: SuratCredentials,
  code: string,
  orderDisplayId: number | string | null
): Promise<void> {
  try {
    await api.remove(credentials, code)
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

/** Registers the parcel; any failure but a fault leaves nothing open at Sürat, or says so. */
export async function openSuratParcel(
  api: SuratApi,
  credentials: SuratCredentials,
  input: SuratShipmentInput,
  orderDisplayId: number | string | null
): Promise<void> {
  try {
    await api.createShipment(credentials, input)
  } catch (error) {
    if (!faulted(error)) {
      await takeBack(api, credentials, input.code, orderDisplayId)
    }
    throw error
  }
}

/**
 * Cancels the parcel at Sürat: deleted while the branch has not taken it;
 * after that, asked back (`GonderiGeriCek`), and the fulfillment stays so
 * tracking follows it home (`surat.withdraw_requested`). Nothing at Sürat
 * under the code: nothing to cancel.
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
      return
    }
    if (!isProviderError(error) || error.providerCode !== "rejected") {
      throw error
    }
  }
  await api.withdraw(credentials, code)
  throw new ValidationError("surat.withdraw_requested")
}
