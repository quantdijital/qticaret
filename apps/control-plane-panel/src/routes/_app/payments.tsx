import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { PAYMENT_VIEWS } from "@/features/billing/api"
import { PaymentsPage } from "@/features/billing/pages/payments-page"

// The list's view in the address (docs/18 §7): a link, a reload or the back button keeps it
const search = z.object({
  view: z.enum(PAYMENT_VIEWS).catch("upcoming").default("upcoming"),
  q: z.string().max(100).catch("").default(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
})

/** The platform's payments (adr/0061 §7, Ek C16): every role reads them. */
export const Route = createFileRoute("/_app/payments")({
  validateSearch: search,
  component: PaymentsPage,
})
