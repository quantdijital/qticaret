import { z } from "@medusajs/framework/zod"
import { PRIVACY_REQUEST_CHANNELS, PRIVACY_REQUEST_KINDS } from "../../../modules/legal/service"

/** A KVKK request as it came (F13.5): what, how, when; never in the future. */
export const AdminPostPrivacyRequest = z
  .object({
    kind: z.enum(PRIVACY_REQUEST_KINDS),
    channel: z.enum(PRIVACY_REQUEST_CHANNELS),
    received_at: z.iso
      .datetime({ offset: true })
      .refine((value) => new Date(value).getTime() <= Date.now() + 60_000, {
        message: "privacy_requests.received_in_future",
      }),
  })
  .strict()
export type AdminPostPrivacyRequestType = z.infer<typeof AdminPostPrivacyRequest>

export const AdminPostPrivacyRequestClose = z
  .object({ status: z.enum(["completed", "rejected"]) })
  .strict()
export type AdminPostPrivacyRequestCloseType = z.infer<typeof AdminPostPrivacyRequestClose>

export const AdminPostPrivacyRequestEmpty = z.object({}).strict()
