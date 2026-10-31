import { linkOptions } from "@tanstack/react-router"
import type { IntegrationGroup } from "@/features/settings/api/integrations"

/**
 * The Integrations page's groups in order, and where each service is set
 * up (F12.2). A service with no page (the cache) has no link.
 */
export const INTEGRATION_GROUPS: readonly IntegrationGroup[] = [
  "payments",
  "shipping",
  "messaging",
  "marketing",
  "accounting",
  "infrastructure",
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
    case "geliver":
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
    case "accounting":
      return linkOptions({ to: "/settings/einvoice", search: { part: "accounting" } })
    default:
      return null
  }
}
