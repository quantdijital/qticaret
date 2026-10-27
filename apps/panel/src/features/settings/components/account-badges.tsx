import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import type { AccountState, ProviderAccount } from "@/features/settings/api/payments"
import { inTestMode } from "@/features/settings/payment-methods"

const STATE_TONES: Record<AccountState, StatusTone> = {
  connected: "success",
  unverified: "warning",
  rejected: "danger",
  unreadable: "danger",
  not_configured: "neutral",
}

/** A provider account's state, and test mode when it is on: the same on the list and the page. */
export function AccountBadges({
  account,
  name,
}: {
  account: ProviderAccount | undefined
  /** The provider's name, for "PayTR refused". */
  name: string
}) {
  const { t } = useTranslation()
  const state = account?.state ?? "not_configured"
  return (
    <>
      {inTestMode(account) ? (
        <StatusBadge tone="info">{t("settings.payments.testModeBadge")}</StatusBadge>
      ) : null}
      <StatusBadge tone={STATE_TONES[state]}>
        {t(`settings.payments.states.${state}`, { name })}
      </StatusBadge>
    </>
  )
}
