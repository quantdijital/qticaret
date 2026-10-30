import { z } from "@medusajs/framework/zod"

export const AdminGetGlobalSearch = z
  .object({
    q: z.string().trim().min(2).max(100),
  })
  .strict()
export type AdminGetGlobalSearchType = z.infer<typeof AdminGetGlobalSearch>
