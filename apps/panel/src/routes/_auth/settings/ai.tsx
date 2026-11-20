import { createFileRoute } from "@tanstack/react-router"
import { AiPage } from "@/features/settings/pages/ai-page"
import { settingsTabSearch } from "@/features/settings/tab-search"

export const Route = createFileRoute("/_auth/settings/ai")({
  validateSearch: settingsTabSearch,
  component: AiPage,
})
