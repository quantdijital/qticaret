import { createFileRoute } from "@tanstack/react-router"
import { SmsPage } from "@/features/settings/pages/sms-page"

export const Route = createFileRoute("/_auth/settings/sms/")({
  component: SmsPage,
})
