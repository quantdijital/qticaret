import { z } from "@medusajs/framework/zod"

/** A draft's planned publish (S2): the moment with its offset; null cancels. */
export const AdminPostProductPublishSchedule = z
  .object({ publish_at: z.iso.datetime({ offset: true }).nullable() })
  .strict()

export type AdminPostProductPublishScheduleType = z.infer<typeof AdminPostProductPublishSchedule>
