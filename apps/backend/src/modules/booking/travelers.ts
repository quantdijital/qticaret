import { MedusaError, generateEntityId } from "@medusajs/framework/utils"
import { decryptPii, encryptPii, hashPii } from "@qticaret/server-kit"
import type { CleanTraveler } from "../../lib/booking/travelers"
import { rows } from "./sql"
import type { Executor } from "./sql"

/**
 * Travelers' rows (adr/0076 §7, K8): an ID or passport number is kept
 * encrypted with the shop's PII key, bound to its cart, beside a keyed
 * hash and its last four characters (two when shorter than eight, adr/0009); nothing else.
 */

/** Domain separation for the number's ciphertext and hash. */
const DOCUMENT_CONTEXT = "booking_traveler.document"
const encryptionContext = (cartId: string) => `${DOCUMENT_CONTEXT}:${cartId}`
export const TRAVELER_KEY_VERSION = 1

export interface TravelerKeys {
  encryption: Buffer
  hash: Buffer
}

/** A traveler as written: the number sealed, never plain. */
export interface SealedTraveler {
  slot_id: string
  position: number
  first_name: string
  last_name: string
  birth_date: string | null
  nationality: string | null
  document_encrypted: string | null
  document_hash: string | null
  document_last4: string | null
  key_version: number | null
  purge_after: Date
}

// The tail kept plain: four characters, two of a short number (5–7) so most of it stays hidden
const shownLength = (number: string): number => (number.length >= 8 ? 4 : 2)

/** The keyed hash a cleaned number is found by (a KVKK request's search; adr/0076 Ek D6b). */
export const documentHashOf = (keys: TravelerKeys, number: string): string =>
  hashPii(number, keys.hash, DOCUMENT_CONTEXT)

/** The number sealed for the cart; the rest as it came. */
export function sealTraveler(
  keys: TravelerKeys,
  cartId: string,
  traveler: CleanTraveler,
  purgeAfter: Date
): SealedTraveler {
  const number = traveler.document_no
  return {
    slot_id: traveler.slot_id,
    position: traveler.position,
    first_name: traveler.first_name,
    last_name: traveler.last_name,
    birth_date: traveler.birth_date,
    nationality: traveler.nationality,
    document_encrypted: number
      ? encryptPii(number, keys.encryption, encryptionContext(cartId))
      : null,
    document_hash: number ? documentHashOf(keys, number) : null,
    document_last4: number ? number.slice(-shownLength(number)) : null,
    key_version: number ? TRAVELER_KEY_VERSION : null,
    purge_after: purgeAfter,
  }
}

const COLUMNS = [
  "id",
  "cart_id",
  "slot_id",
  "position",
  "first_name",
  "last_name",
  "birth_date",
  "nationality",
  "document_encrypted",
  "document_hash",
  "document_last4",
  "key_version",
  "purge_after",
] as const

/**
 * The cart's travelers not yet booked replaced by these (the storefront
 * sends them all at once). A booked cart's are left alone.
 */
export async function replaceCartTravelers(
  manager: Executor,
  cartId: string,
  travelers: readonly SealedTraveler[]
): Promise<number> {
  await manager.execute(`DELETE FROM booking_traveler WHERE cart_id = ? AND booking_id IS NULL`, [
    cartId,
  ])
  if (travelers.length === 0) {
    return 0
  }
  const row = `(${COLUMNS.map(() => "?").join(", ")}, now(), now())`
  await manager.execute(
    `INSERT INTO booking_traveler (${COLUMNS.join(", ")}, created_at, updated_at)
     VALUES ${travelers.map(() => row).join(", ")}`,
    travelers.flatMap((traveler) => [
      generateEntityId(undefined, "bktrv"),
      cartId,
      traveler.slot_id,
      traveler.position,
      traveler.first_name,
      traveler.last_name,
      traveler.birth_date,
      traveler.nationality,
      traveler.document_encrypted,
      traveler.document_hash,
      traveler.document_last4,
      traveler.key_version,
      traveler.purge_after,
    ])
  )
  return travelers.length
}

/** A booked traveler's full number, or null when none was asked; unknown: 404. */
export async function revealDocument(
  manager: Executor,
  keys: TravelerKeys,
  travelerId: string
): Promise<string | null> {
  const [row] = await rows(
    manager,
    `SELECT cart_id, document_encrypted, key_version FROM booking_traveler
     WHERE id = ? AND booking_id IS NOT NULL AND deleted_at IS NULL`,
    [travelerId]
  )
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.traveler_unknown")
  }
  const sealed = row["document_encrypted"]
  if (typeof sealed !== "string") {
    return null
  }
  if (Number(row["key_version"]) !== TRAVELER_KEY_VERSION) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "unknown traveler key version")
  }
  return decryptPii(sealed, keys.encryption, encryptionContext(String(row["cart_id"])))
}
