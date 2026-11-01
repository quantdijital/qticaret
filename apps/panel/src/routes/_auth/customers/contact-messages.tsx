import { createFileRoute } from "@tanstack/react-router"
import { ContactMessagesPage } from "@/features/customers/pages/contact-messages-page"
import { contactMessageSearchSchema } from "@/features/customers/search"

export const Route = createFileRoute("/_auth/customers/contact-messages")({
  validateSearch: contactMessageSearchSchema,
  component: ContactMessagesPage,
})
