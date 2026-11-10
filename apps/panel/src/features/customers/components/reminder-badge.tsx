import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { AbandonedCart } from "@/features/customers/api/abandoned-carts"

const R = "customers.abandoned.reminder"

/** What the cart's one reminder came to, if it was tried (adr/0038 §1). */
function stateOf(reminder: AbandonedCart["reminder"]): { key: string; tone: StatusTone } {
  if (!reminder) {
    return { key: "none", tone: "neutral" }
  }
  if (reminder.outcome === "sent") {
    return reminder.returned ? { key: "returned", tone: "success" } : { key: "sent", tone: "info" }
  }
  if (reminder.outcome === "pending") {
    return { key: "pending", tone: "info" }
  }
  if (reminder.outcome === "no_consent") {
    return { key: "no_consent", tone: "warning" }
  }
  return { key: "not_sent", tone: "warning" }
}

export function ReminderBadge({ reminder }: { reminder: AbandonedCart["reminder"] }) {
  const { t } = useTranslation()
  const { key, tone } = stateOf(reminder)
  return <StatusBadge tone={tone}>{t(`${R}.${key}`)}</StatusBadge>
}
