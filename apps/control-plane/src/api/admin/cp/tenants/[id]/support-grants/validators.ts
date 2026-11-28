import { z } from "@medusajs/framework/zod"
import {
  SUPPORT_REASON_MAX,
  SUPPORT_REASON_MIN,
  SUPPORT_SESSION_MINUTES,
} from "@qticaret/types/control-plane"
import { CLEAN } from "../../../../../../lib/clean-text"

/**
 * A support grant's request (adr/0061 Ek 2026-11-28, Karar 7): why, in one
 * plain line (it reaches the shop's owner as written), and for how long.
 */
export const PostSupportGrant = z
  .object({
    reason: z
      .string()
      .trim()
      .min(SUPPORT_REASON_MIN, "cp.support_reason_required")
      .max(SUPPORT_REASON_MAX)
      .regex(CLEAN, "cp.text_invalid"),
    minutes: z.union(SUPPORT_SESSION_MINUTES.map((value) => z.literal(value))),
  })
  .strict()
export type PostSupportGrantType = z.infer<typeof PostSupportGrant>
