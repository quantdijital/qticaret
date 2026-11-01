import { z } from "@medusajs/framework/zod"
import { PRIVACY_REQUEST_KINDS } from "../../../../../modules/legal/models/privacy-request"

/** A signed-in customer's KVKK request from their account: a copy of their data, or its erasure. */
export const StorePostPrivacyRequest = z.object({ kind: z.enum(PRIVACY_REQUEST_KINDS) }).strict()
export type StorePostPrivacyRequestType = z.infer<typeof StorePostPrivacyRequest>
