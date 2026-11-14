import { z } from "@medusajs/framework/zod"
import { recordId } from "../layout-fields"

/** Where a rail's products come from, shared by the rails: a collection's or chosen ones. */
export const collectionSource = z
  .object({ kind: z.literal("collection"), collection_id: recordId })
  .strict()

export const manualSource = (max: number) =>
  z.object({ kind: z.literal("manual"), product_ids: z.array(recordId).min(1).max(max) }).strict()
