import { validateAndTransformBody } from "@medusajs/framework/http"
import { AdminPostBankTransferConfirm } from "../admin/orders/[id]/bank-transfer/confirm/validators"
import { requireUserActor } from "./actor"

/** F6 W2 (adr/0029): a staff member confirms a bank transfer's money; integration keys cannot. */
export const BANK_TRANSFER_ROUTES = [
  {
    matcher: "/admin/orders/:id/bank-transfer/confirm",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostBankTransferConfirm)],
  },
]
