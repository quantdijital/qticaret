import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { TravelerPrintPage } from "@/features/products/booking/traveler-print-page"

/** `/print/departure?slot=bkslot_1&zone=Europe/Istanbul&at=…`: a departure's travelers to print. */
export const Route = createFileRoute("/_fullscreen/print/departure")({
  validateSearch: z.object({
    slot: z.string().max(80).optional().catch(undefined),
    zone: z.string().max(64).optional().catch(undefined),
    at: z.string().max(40).optional().catch(undefined),
  }),
  component: TravelerPrintPage,
})
