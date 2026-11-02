import { z } from "@medusajs/framework/zod"

/** An unsubscribe link's token: `<recipient hash>.<signature>` (adr/0038 §1). */
export const StorePostUnsubscribe = z
  .object({ token: z.string().regex(/^[0-9a-f]{64}\.[\w-]{43}$/) })
  .strict()
export type StorePostUnsubscribeType = z.infer<typeof StorePostUnsubscribe>
