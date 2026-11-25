import { createFileRoute } from "@tanstack/react-router"
import { AiSettingsPage } from "@/features/ai-credits/pages/ai-settings-page"
import { requireOwner } from "../-require-member"

/** The AI providers, routing, packs and limits: the owner's alone (adr/0085 §5). */
export const Route = createFileRoute("/_app/ai-settings")({
  beforeLoad: ({ context }) => {
    requireOwner(context.me)
  },
  component: AiSettingsPage,
})
