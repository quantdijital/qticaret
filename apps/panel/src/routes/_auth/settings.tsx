import { createFileRoute } from "@tanstack/react-router"
import { SettingsLayout } from "@/features/settings/pages/settings-layout"

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsLayout,
})
