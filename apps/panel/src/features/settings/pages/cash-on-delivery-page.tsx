import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { useFeatureState } from "@/features/settings/api/features"
import { sectionQuery } from "@/features/settings/api/sections"
import type { CashOnDeliverySettings } from "@/features/settings/api/sections"
import { CashOnDeliverySettingsCards } from "@/features/settings/components/cash-on-delivery-settings"
import { errorText } from "@/lib/errors"

const P = "settings.payments"

/** Settings > Payment > Cash on delivery (F6, adr/0029): whether it is offered, its fee and couriers. */
export function CashOnDeliveryPage() {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<CashOnDeliverySettings>("cash_on_delivery"))
  const enabled = useFeatureState("payments.cash_on_delivery")
  const saved = query.data?.values
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/settings/payments", label: t(`${P}.title`) }}
        title={t(`${P}.methods.cash_on_delivery.name`)}
        description={t(`${P}.methods.cash_on_delivery.description`)}
        badge={
          enabled === undefined ? null : (
            <StatusBadge tone={enabled ? "success" : "neutral"}>
              {t(enabled ? `${P}.offered.on` : `${P}.offered.off`)}
            </StatusBadge>
          )
        }
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !saved ? (
        <LoadingRows rows={4} />
      ) : (
        <CashOnDeliverySettingsCards saved={saved} />
      )}
    </div>
  )
}
