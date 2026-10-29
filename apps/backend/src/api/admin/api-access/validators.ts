import { z } from "@medusajs/framework/zod"
import { API_SCOPES } from "../../../lib/api-access"
import { isCleanText } from "../../../lib/security"

/** A new key: a name staff will know it by, and at least one scope. */
export const AdminPostApiKey = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine(isCleanText, { message: "api_key.title_invalid" }),
    scopes: z
      .array(z.enum(API_SCOPES))
      .min(1, "api_key.scopes_required")
      .refine((scopes) => new Set(scopes).size === scopes.length, {
        message: "api_key.scopes_required",
      }),
  })
  .strict()
export type AdminPostApiKeyType = z.infer<typeof AdminPostApiKey>

/** A revoke takes no body: anything sent is refused. */
export const AdminPostApiKeyRevoke = z.object({}).strict()
