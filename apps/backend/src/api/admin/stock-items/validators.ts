import { z } from "@medusajs/framework/zod"

/** `?offset=&limit=`: an item's stock movements, newest first. */
export const AdminGetStockMovements = z
  .object({
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
export type AdminGetStockMovementsType = z.infer<typeof AdminGetStockMovements>

/** The item's own low-stock threshold; null follows the shop's. */
export const AdminPostStockWatch = z
  .object({ threshold: z.number().int().min(0).max(100_000).nullable() })
  .strict()
export type AdminPostStockWatchType = z.infer<typeof AdminPostStockWatch>
