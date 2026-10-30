import { z } from "@medusajs/framework/zod"

/** `POST /store/customers/me/migration-claim`: the key the invitation carried. */
export const StorePostMigrationClaim = z
  .object({ token: z.string().trim().min(1).max(200) })
  .strict()
export type StorePostMigrationClaimType = z.infer<typeof StorePostMigrationClaim>
