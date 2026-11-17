import { createFileRoute } from "@tanstack/react-router"
import { AiPage } from "@/features/settings/pages/ai-page"

export const Route = createFileRoute("/_auth/settings/ai")({
  component: AiPage,
})
