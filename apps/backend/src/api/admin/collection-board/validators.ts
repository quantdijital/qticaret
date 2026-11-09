import { z } from "@medusajs/framework/zod"

/** `?q=&offset=&limit=`: collections by title, a page at a time. */
export const AdminGetCollectionBoard = z
  .object({
    q: z.string().trim().max(200).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
export type AdminGetCollectionBoardType = z.infer<typeof AdminGetCollectionBoard>
