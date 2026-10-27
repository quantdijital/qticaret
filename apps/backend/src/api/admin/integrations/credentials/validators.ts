import { z } from "@medusajs/framework/zod"

/**
 * A provider account from the panel (adr/0027). The provider's own schema
 * checks the fields (`integration-credentials/providers.ts`); here only the
 * shape and a size bound. A blank or null secret keeps the stored one.
 */
export const AdminPostCredentials = z
  .object({
    settings: z.record(z.string().max(64), z.unknown()),
    secrets: z.record(z.string().max(64), z.string().max(256).nullable()).optional(),
  })
  .strict()

export type AdminPostCredentialsType = z.infer<typeof AdminPostCredentials>
