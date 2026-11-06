import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { PrintOrdersPage } from "@/features/orders/print/print-page"

/** `/print/orders?kind=slip|pick&ids=order_1,order_2`: packing slips or a pick list to print. */
export const Route = createFileRoute("/_fullscreen/print/orders")({
  validateSearch: z.object({
    kind: z.enum(["slip", "pick"]).optional().catch(undefined),
    ids: z.string().max(3000).optional().catch(undefined),
  }),
  component: PrintOrdersPage,
})
