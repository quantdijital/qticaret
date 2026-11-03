import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { paymentLinkQuery } from "@/features/payment-links/api/payment-links"
import { LinkGate } from "@/features/payment-links/components/link-gate"
import { useLinkAccess } from "@/features/payment-links/components/use-link-access"
import { LinkForm } from "@/features/payment-links/create/link-form"
import { EMPTY_FORM } from "@/features/payment-links/form"
import { valuesFromLink } from "@/features/payment-links/request"
import { errorText } from "@/lib/errors"

const P = "paymentLinks"
const route = getRouteApi("/_auth/payment-links/new")

/** The form, empty or filled from the link it repeats ("Yeniden oluştur"). */
function NewLinkBody({ from, canDiscount }: { from: string | undefined; canDiscount: boolean }) {
  const { t } = useTranslation()
  const source = useQuery({ ...paymentLinkQuery(from ?? ""), enabled: from !== undefined })
  if (from === undefined) {
    return <LinkForm defaults={EMPTY_FORM} canDiscount={canDiscount} />
  }
  if (source.isError) {
    return <ErrorState text={errorText(t, source.error)} onRetry={() => void source.refetch()} />
  }
  if (!source.data) {
    return <LoadingRows rows={8} />
  }
  return (
    <LinkForm
      key={source.data.id}
      defaults={valuesFromLink(source.data, canDiscount)}
      canDiscount={canDiscount}
    />
  )
}

/**
 * Siparişler > Yeni sipariş (adr/0051 §13): staff prepare an order for a
 * customer; the backend prices it and the customer pays through the link.
 */
export function NewPaymentLinkPage() {
  const { t } = useTranslation()
  const gate = useLinkAccess()
  const { from } = route.useSearch()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/payment-links", label: t(`${P}.title`) }}
        title={t(`${P}.newTitle`)}
        description={t(from ? `${P}.newFromDescription` : `${P}.newDescription`)}
      />
      <LinkGate gate={gate}>
        <NewLinkBody from={from} canDiscount={gate.canManage} />
      </LinkGate>
    </div>
  )
}
