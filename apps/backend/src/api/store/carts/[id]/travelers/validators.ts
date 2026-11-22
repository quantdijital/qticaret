import { z } from "@medusajs/framework/zod"
import { MAX_TRAVELERS } from "../../../../../lib/booking/travelers"

const id = z.string().min(1).max(64)
const text = (max: number) => z.string().max(max)

/**
 * A cart's travelers (adr/0076 §7), all of them at once: each on a
 * departure in the cart, in the order the form lists them. Which fields
 * are needed is the product's (`traveler_fields`) and checked on the
 * server, as is how many (Σ quantity × pax); a field the product does not
 * ask is refused (no more than needed). Anything else is refused.
 */
export const StorePostCartTravelers = z
  .object({
    travelers: z
      .array(
        z
          .object({
            slot_id: id,
            first_name: text(200),
            last_name: text(200),
            birth_date: text(10).optional(),
            document_no: text(40).optional(),
            nationality: text(2).optional(),
          })
          .strict()
      )
      .max(MAX_TRAVELERS),
  })
  .strict()

export type StorePostCartTravelersType = z.infer<typeof StorePostCartTravelers>
