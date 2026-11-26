import { linkOptions } from "@tanstack/react-router"
import type { IntegrationGroup } from "@/features/settings/api/integrations"

/**
 * The Integrations page's groups in order, and where each service is set
 * up (F12.2). Only services the shop uses: no accounting program until
 * one is written (adr/0039 §5), nothing of the platform's own.
 */
export const INTEGRATION_GROUPS: readonly IntegrationGroup[] = [
  "payments",
  "shipping",
  "messaging",
  "marketing",
]

const payment = (provider: string) =>
  linkOptions({ to: "/settings/payments/$provider", params: { provider } })
const carrier = (id: string) =>
  linkOptions({ to: "/settings/shipping/$carrier", params: { carrier: id } })
const marketing = (provider: string) =>
  linkOptions({ to: "/settings/marketing/$provider", params: { provider } })

export function settingsLinkOf(id: string) {
  switch (id) {
    case "paytr":
    case "iyzico":
    case "bank_transfer":
    case "cash_on_delivery":
      return payment(id)
    case "aras":
    case "yurtici":
      return carrier(id)
    case "meta":
    case "ga4":
      return marketing(id)
    case "netgsm":
      return linkOptions({ to: "/settings/notifications", search: { part: "sms" } })
    case "resend":
      return linkOptions({ to: "/settings/notifications" })
    case "google":
    case "feeds":
      return linkOptions({ to: "/settings/marketing" })
    // adr/0071 §13: the AI services are set up on their own page
    case "deepseek":
    case "minimax":
    case "qwen":
    case "gemini":
    case "photoroom":
    case "bria":
      return linkOptions({ to: "/settings/ai" })
    default:
      return null
  }
}
