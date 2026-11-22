import { z } from "@medusajs/framework/zod"
import { MAX_TRAVELERS } from "../../../lib/booking/travelers"

const text = (max: number) => z.string().max(max)

/**
 * A traveler's KVKK request (adr/0076 Ek D6b): who is asking, as they
 * gave it. The name always; the birth date and the ID or passport number
 * when the product asked them. Checked again on the server (a name, a
 * real day, a number's shape); anything else is refused.
 */
export const AdminPostTravelerSearch = z
  .object({
    first_name: text(200),
    last_name: text(200),
    birth_date: text(10).optional(),
    document_no: text(40).optional(),
  })
  .strict()
export type AdminPostTravelerSearchType = z.infer<typeof AdminPostTravelerSearch>

/** The rows the search found that the request asks to delete. */
export const AdminPostTravelerErase = z
  .object({
    ids: z.array(z.string().min(1).max(64)).min(1).max(MAX_TRAVELERS),
  })
  .strict()
export type AdminPostTravelerEraseType = z.infer<typeof AdminPostTravelerErase>
