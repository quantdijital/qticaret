import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { AI_CREDIT_ORDER_STATUSES } from "@qticaret/types/control-plane"
import { ORDERS_PAGE_MAX } from "@/features/ai-credits/api/queries"
import { OrdersPage } from "@/features/ai-credits/pages/orders-page"
import { requireOwner } from "../-require-member"

// The list's status and page in the address (docs/18 §7); a page past the server's last goes to 1
const search = z.object({
  status: z.enum(AI_CREDIT_ORDER_STATUSES).catch("pending").default("pending"),
  page: z.coerce.number().int().min(1).max(ORDERS_PAGE_MAX).catch(1).default(1),
})

/** The shops' AI credit top-up requests: the owner's alone (adr/0085 K11). */
export const Route = createFileRoute("/_app/ai-orders")({
  validateSearch: search,
  beforeLoad: ({ context }) => {
    requireOwner(context.me)
  },
  component: OrdersPage,
})
