import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { CircleCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { EmptyRow } from "@qticaret/admin-ui/patterns/empty-row"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Alert, AlertAction, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useWholesaleOpen } from "@/features/wholesale/api/access"
import { accountQuery, useUpdateAccount } from "@/features/wholesale/api/accounts"
import type { WholesaleAccount } from "@/features/wholesale/api/types"
import { AccountActions } from "@/features/wholesale/components/account-actions"
import { AccountBadge } from "@/features/wholesale/components/account-badge"
import { AccountInfoCard, AccountStatusCard } from "@/features/wholesale/components/account-cards"
import { PriceLinesCard } from "@/features/wholesale/components/price-lines-card"
import { WarningNote } from "@/features/wholesale/components/warning-note"
import { WholesaleGate } from "@/features/wholesale/components/wholesale-gate"
import { accountSubtitle, accountTitle } from "@/features/wholesale/format"
import { outcomeLines, useOutcome } from "@/features/wholesale/outcome"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/wholesale/$id")
const D = "wholesale.detail"
const BACK = "/wholesale"

/** What happened when the wholesaler was opened, said once on arriving here. */
function CreatedNotice({ id }: { id: string }) {
  const { t } = useTranslation()
  const [outcome, dismiss] = useOutcome(id)
  if (!outcome) {
    return null
  }
  const { keys, warning } = outcomeLines(outcome)
  const words = keys.map((key) => t(key)).join(" ")
  const close = (
    <Button size="sm" variant="outline" onClick={dismiss}>
      {t("common.close")}
    </Button>
  )
  return warning ? (
    <WarningNote action={close}>{words}</WarningNote>
  ) : (
    <Alert role="status">
      <CircleCheck />
      <AlertDescription>{words}</AlertDescription>
      <AlertAction>{close}</AlertAction>
    </Alert>
  )
}

/** The own list's prices, or one line offering to open it. */
function OwnPrices({ account }: { account: WholesaleAccount }) {
  const { t } = useTranslation()
  const update = useUpdateAccount(account.id)
  if (account.own_prices) {
    return (
      <PriceLinesCard
        owner={{ kind: "account", id: account.id }}
        percent={account.percent}
        syncing={account.sync_pending}
      />
    )
  }
  return (
    <EmptyRow
      text={t(`${D}.noOwnPrices`)}
      action={
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => {
            update.mutate(
              { own_prices: true },
              {
                onSuccess: () => toast.success(t(`${D}.ownOpened`)),
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          {t(`${D}.openOwn`)}
        </Button>
      }
    />
  )
}

function WholesalerBody({ id }: { id: string }) {
  const { t } = useTranslation()
  const query = useQuery(accountQuery(id))
  const back = { to: BACK, label: t("wholesale.list.title") }
  if (query.isError && !query.data) {
    return (
      <>
        <PageHeader title={t(`${D}.title`)} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </>
    )
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title={t("common.loading")} back={back} />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </>
    )
  }
  const account = query.data
  return (
    <>
      <PageHeader
        title={accountTitle(account)}
        description={accountSubtitle(account) || undefined}
        badge={<AccountBadge status={account.status} />}
        back={back}
        action={<AccountActions account={account} />}
      />
      <CreatedNotice id={account.id} />
      <PageGrid>
        <PageColumn span={8}>
          <AccountInfoCard account={account} />
        </PageColumn>
        <PageColumn span={4}>
          <AccountStatusCard account={account} />
        </PageColumn>
      </PageGrid>
      <OwnPrices account={account} />
    </>
  )
}

/**
 * One wholesaler (ADR-0068 slice 2, docs/06 "Detay sayfası düzeni"): who
 * they are and their terms, the state and invitation on the right, the
 * actions in the header, and their own prices below when they have them.
 */
export function WholesalerPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const ready = useWholesaleOpen()
  return (
    <div className="flex flex-col gap-6">
      {ready ? (
        <WholesalerBody id={id} />
      ) : (
        <>
          <PageHeader
            title={t(`${D}.title`)}
            back={{ to: BACK, label: t("wholesale.list.title") }}
          />
          <WholesaleGate>{null}</WholesaleGate>
        </>
      )}
    </div>
  )
}
