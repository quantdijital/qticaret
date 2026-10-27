import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { sectionQuery } from "@/features/settings/api/sections"
import type { BankTransferSettings } from "@/features/settings/api/sections"
import { BankTransferSettingsCards } from "@/features/settings/components/bank-transfer-settings"
import { errorText } from "@/lib/errors"

const P = "settings.payments"

/** Settings > Payment > Bank transfer (F6, adr/0029): whether it is offered, and the account. */
export function BankTransferPage() {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<BankTransferSettings>("bank_transfer"))
  const saved = query.data?.values
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/settings/payments", label: t(`${P}.title`) }}
        title={t(`${P}.methods.bank_transfer.name`)}
        description={t(`${P}.methods.bank_transfer.description`)}
        badge={
          saved ? (
            <StatusBadge tone={saved.enabled ? "success" : "neutral"}>
              {t(saved.enabled ? `${P}.bankTransfer.on` : `${P}.bankTransfer.off`)}
            </StatusBadge>
          ) : null
        }
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !saved ? (
        <LoadingRows rows={4} />
      ) : (
        <BankTransferSettingsCards saved={saved} />
      )}
    </div>
  )
}
