import { z } from "@medusajs/framework/zod"

/** Nothing to send: who confirms comes from the session, what is paid from the order. */
export const AdminPostBankTransferConfirm = z.object({}).strict()
