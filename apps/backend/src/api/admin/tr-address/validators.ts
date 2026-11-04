import { z } from "@medusajs/framework/zod"

/** `POST /admin/tr-address/sync`: nothing to choose; the source is TürkiyeAPI. */
export const AdminPostTrAddressSync = z.object({}).strict()
export type AdminPostTrAddressSyncType = z.infer<typeof AdminPostTrAddressSync>

export const AdminGetTrAddressStatus = z.object({}).strict()
export type AdminGetTrAddressStatusType = z.infer<typeof AdminGetTrAddressStatus>
