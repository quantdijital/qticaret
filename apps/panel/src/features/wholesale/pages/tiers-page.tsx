import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Layers, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useWholesaleOpen } from "@/features/wholesale/api/access"
import { TIERS_PAGE_SIZE, tiersQuery } from "@/features/wholesale/api/tiers"
import type { WholesaleTier } from "@/features/wholesale/api/types"
import { TierDialog } from "@/features/wholesale/components/tier-dialog"
import { WholesaleGate } from "@/features/wholesale/components/wholesale-gate"
import { WholesaleNav } from "@/features/wholesale/components/wholesale-nav"
import { ratePercent } from "@/features/wholesale/format"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/wholesale/tiers/")
const T = "wholesale.tiers"

function useTierColumns(): Column<WholesaleTier>[] {
  const { t } = useTranslation()
  return [
    {
      key: "name",
      header: t(`${T}.columns.name`),
      cell: (tier) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{tier.name}</span>
          {tier.sync_pending ? (
            <span className="text-xs text-muted-foreground">{t("wholesale.prices.syncing")}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "percent",
      header: t(`${T}.columns.percent`),
      align: "right",
      cell: (tier) => (
        <span className="tabular-nums">
          {tier.percent === null ? t(`${T}.manualOnly`) : ratePercent(tier.percent)}
        </span>
      ),
    },
    {
      key: "minimum",
      header: t(`${T}.columns.minimum`),
      align: "right",
      cell: (tier) => (
        <span className="tabular-nums">
          {tier.min_quantity === null ? "—" : t("wholesale.units", { count: tier.min_quantity })}
        </span>
      ),
    },
  ]
}

function TiersList({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const page = (route.useSearch().page ?? 1) - 1
  const list = useQuery(tiersQuery(page))
  const columns = useTierColumns()
  if (list.isError) {
    return <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
  }
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card">
      <DataTable
        columns={columns}
        rows={list.data?.tiers}
        rowKey={(tier) => tier.id}
        loading={list.isPending}
        stale={list.isPlaceholderData}
        onRowClick={(tier) => {
          void navigate({ to: "/wholesale/tiers/$id", params: { id: tier.id } })
        }}
        empty={
          <div className="flex flex-col items-center gap-3 text-center">
            <Layers className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-md text-sm text-muted-foreground">{t(`${T}.empty`)}</p>
            <Button variant="outline" onClick={onAdd}>
              <Plus />
              {t(`${T}.add`)}
            </Button>
          </div>
        }
      />
      {list.data && list.data.count > TIERS_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={TIERS_PAGE_SIZE}
          count={list.data.count}
          onPageChange={(next) => {
            void navigate({
              to: "/wholesale/tiers",
              search: { page: next > 0 ? next + 1 : undefined },
              replace: true,
            })
          }}
        />
      ) : null}
    </section>
  )
}

/**
 * Toptancılar > Toptan seviyeleri (ADR-0068 §1): the levels wholesalers
 * buy at ("Toptan A"), each a rate off every variant and/or prices by
 * hand, and the fewest units an order holds.
 */
export function TiersPage() {
  const { t } = useTranslation()
  const ready = useWholesaleOpen()
  const [adding, setAdding] = useState(false)
  const open = () => {
    setAdding(true)
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${T}.title`)}
        description={t(`${T}.description`)}
        action={
          ready ? (
            <Button onClick={open}>
              <Plus />
              {t(`${T}.add`)}
            </Button>
          ) : undefined
        }
      />
      <WholesaleNav />
      <WholesaleGate>
        <TiersList onAdd={open} />
        <TierDialog tier={null} open={adding} onOpenChange={setAdding} />
      </WholesaleGate>
    </div>
  )
}
