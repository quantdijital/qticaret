import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi } from "@tanstack/react-router"
import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Alert, AlertDescription, AlertTitle } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { paymentLinkQuery } from "@/features/payment-links/api/payment-links"
import type { PaymentLink } from "@/features/payment-links/api/types"
import { LinkGate } from "@/features/payment-links/components/link-gate"
import { useExpiryRedraw, shownStatus } from "@/features/payment-links/components/link-state"
import { LinkLines, LinkTotals } from "@/features/payment-links/components/link-lines"
import { LinkStatusBadge } from "@/features/payment-links/components/link-status"
import { useLinkAccess } from "@/features/payment-links/components/use-link-access"
import { FactsCard } from "@/features/payment-links/detail/facts-card"
import { LinkActions } from "@/features/payment-links/detail/link-actions"
import { PeopleCards } from "@/features/payment-links/detail/people-cards"
import { ShareCard } from "@/features/payment-links/detail/share-card"
import { errorText } from "@/lib/errors"
import { formatLongDate } from "@qticaret/admin-ui/lib/format"

const P = "paymentLinks"
const route = getRouteApi("/_auth/payment-links/$id")

/** A link whose prices moved (`draft`): it opens nothing; a new one at today's prices does. */
function PricesChanged({ link }: { link: PaymentLink }) {
  const { t } = useTranslation()
  return (
    <Alert>
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{t(`${P}.draft.title`)}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        {t(`${P}.draft.description`)}
        <Button asChild size="sm">
          <Link to="/payment-links/new" search={{ from: link.id }}>
            {t(`${P}.actions.again`)}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function LinkView({ link, created }: { link: PaymentLink; created: boolean }) {
  const { t } = useTranslation()
  const gate = useLinkAccess()
  // Past its end it is expired here at once: the badge, the share card and the actions together
  useExpiryRedraw(link)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: "/payment-links", label: t(`${P}.title`) }}
        title={link.number}
        description={t(`${P}.detail.made`, { date: formatLongDate(link.created_at) })}
        badge={<LinkStatusBadge link={link} />}
        action={<LinkActions link={link} canManage={gate.canManage} />}
      />
      {shownStatus(link) === "draft" ? <PricesChanged link={link} /> : null}
      <PageGrid>
        <PageColumn span={8}>
          <PeopleCards link={link} />
          <SectionCard title={t(`${P}.detail.lines`, { count: link.lines.length })}>
            <div className="flex flex-col gap-4">
              <LinkLines lines={link.lines} currency={link.currency_code} />
              <div className="border-t pt-4">
                <LinkTotals
                  itemsTotal={link.items_total}
                  discount={link.discount}
                  discountTotal={link.discount_total}
                  total={link.total}
                  currency={link.currency_code}
                />
              </div>
            </div>
          </SectionCard>
        </PageColumn>
        <PageColumn span={4}>
          <ShareCard link={link} created={created} />
          <FactsCard link={link} />
        </PageColumn>
      </PageGrid>
    </div>
  )
}

/** One payment link (adr/0051 §13): where it stands, who and what, sharing it and its actions. */
export function PaymentLinkPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const { created } = route.useSearch()
  const gate = useLinkAccess()
  const link = useQuery({ ...paymentLinkQuery(id), enabled: gate.access === "ok" })
  const back = { to: "/payment-links", label: t(`${P}.title`) }
  if (gate.access !== "ok") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title={t(`${P}.title`)} />
        <LinkGate gate={gate}>{null}</LinkGate>
      </div>
    )
  }
  if (link.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title={t(`${P}.title`)} />
        <ErrorState text={errorText(t, link.error)} onRetry={() => void link.refetch()} />
      </div>
    )
  }
  if (!link.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title={t("common.loading")} />
        <LoadingRows rows={8} />
      </div>
    )
  }
  return <LinkView key={link.data.id} link={link.data} created={created === true} />
}
