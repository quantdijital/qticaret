import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useWholesaleOpen } from "@/features/wholesale/api/access"
import { tierQuery, useDeleteTier } from "@/features/wholesale/api/tiers"
import type { WholesaleTier } from "@/features/wholesale/api/types"
import { PriceLinesCard } from "@/features/wholesale/components/price-lines-card"
import { TierDialog } from "@/features/wholesale/components/tier-dialog"
import { WholesaleGate } from "@/features/wholesale/components/wholesale-gate"
import { ratePercent } from "@/features/wholesale/format"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/customers/wholesale/tiers/$id")
const T = "wholesale.tiers"
const BACK = "/customers/wholesale/tiers"

function TierActions({ tier }: { tier: WholesaleTier }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const remove = useDeleteTier(tier.id)
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setEditing(true)
        }}
      >
        <Pencil />
        {t("common.edit")}
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t(`${T}.delete`)}
        onClick={() => {
          setConfirm(true)
        }}
      >
        <Trash2 />
      </Button>
      <TierDialog tier={tier} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t(`${T}.deleteTitle`, { name: tier.name })}
        description={t(`${T}.deleteText`)}
        confirmLabel={t(`${T}.delete`)}
        destructive
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.success(t(`${T}.deleted`))
              void navigate({ to: BACK })
            },
            // In use: the server says why (move its wholesalers first)
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}

/** The rate and the minimum in a line under the name. */
function useTierLine(): (tier: WholesaleTier) => string {
  const { t } = useTranslation()
  return (tier) =>
    [
      tier.percent === null
        ? t(`${T}.manualOnly`)
        : t(`${T}.rateLine`, { percent: ratePercent(tier.percent) }),
      tier.min_quantity === null
        ? t(`${T}.noMinimum`)
        : t(`${T}.minimumLine`, { count: tier.min_quantity }),
    ].join(" · ")
}

function TierBody({ id }: { id: string }) {
  const { t } = useTranslation()
  const query = useQuery(tierQuery(id))
  const line = useTierLine()
  const back = { to: BACK, label: t(`${T}.title`) }
  if (query.isError && !query.data) {
    return (
      <>
        <PageHeader title={t(`${T}.one`)} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </>
    )
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title={t("common.loading")} back={back} />
        <Skeleton className="h-96 rounded-lg" />
      </>
    )
  }
  const tier = query.data
  return (
    <>
      <PageHeader
        title={tier.name}
        description={line(tier)}
        back={back}
        action={<TierActions tier={tier} />}
      />
      <PriceLinesCard
        owner={{ kind: "tier", id: tier.id }}
        percent={tier.percent}
        syncing={tier.sync_pending}
      />
    </>
  )
}

/** One wholesale level: its rate and minimum, and its prices (ADR-0068 §4). */
export function TierPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const ready = useWholesaleOpen()
  return (
    <div className="flex flex-col gap-6">
      {ready ? (
        <TierBody id={id} />
      ) : (
        <>
          <PageHeader title={t(`${T}.one`)} back={{ to: BACK, label: t(`${T}.title`) }} />
          <WholesaleGate>{null}</WholesaleGate>
        </>
      )}
    </div>
  )
}
