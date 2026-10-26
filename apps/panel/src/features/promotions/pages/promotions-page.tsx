import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { BadgePercent, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { promotionsQuery } from "@/features/promotions/api/promotions"
import type { Promotion } from "@/features/promotions/api/promotions"
import { OfferText, ScheduleBadge } from "@/features/promotions/components/offer-text"
import { PromotionsNav } from "@/features/promotions/components/promotions-nav"
import { scheduleOf } from "@/features/promotions/offer"
import { errorText } from "@/lib/errors"
import { formatCount, formatDate } from "@/lib/format"

const TABS = ["all", "active", "scheduled", "draft", "ended"] as const
type Tab = (typeof TABS)[number]

const tabOf = (promotion: Promotion): Exclude<Tab, "all"> => {
  const schedule = scheduleOf(promotion.status ?? "draft", promotion.campaign)
  return schedule === "inactive" ? "ended" : schedule
}

function useColumns(batches: Readonly<Record<string, number>>): Column<Promotion>[] {
  const { t } = useTranslation()
  return [
    {
      key: "code",
      header: t("promotions.columns.code"),
      cell: (promotion) => (
        <div className="flex flex-col">
          <Link
            to="/promotions/$id"
            params={{ id: promotion.id }}
            className="font-mono text-[13px] font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            {promotion.code}
          </Link>
          {batches[promotion.id] ? (
            <span className="text-xs text-muted-foreground">
              {t("promotions.codes.batchCount", { count: batches[promotion.id] })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "offer",
      header: t("promotions.columns.offer"),
      cell: (promotion) => <OfferText method={promotion.application_method} />,
    },
    {
      key: "mode",
      header: t("promotions.columns.mode"),
      className: "hidden md:table-cell",
      cell: (promotion) => (
        <span className="text-muted-foreground">
          {t(promotion.is_automatic ? "promotions.automatic" : "promotions.withCode")}
        </span>
      ),
    },
    {
      key: "dates",
      header: t("promotions.columns.dates"),
      className: "hidden lg:table-cell",
      cell: (promotion) => {
        const { starts_at: from, ends_at: to } = promotion.campaign ?? {}
        return (
          <span className="text-muted-foreground tabular-nums">
            {from || to
              ? `${from ? formatDate(from) : "…"} – ${to ? formatDate(to) : "…"}`
              : t("promotions.noDates")}
          </span>
        )
      },
    },
    {
      key: "used",
      header: t("promotions.columns.used"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (promotion) => (
        <span className="tabular-nums">
          {formatCount(promotion.used ?? 0)}
          {promotion.limit ? (
            <span className="text-muted-foreground"> / {formatCount(promotion.limit)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      header: t("promotions.columns.status"),
      align: "right",
      cell: (promotion) => <ScheduleBadge promotion={promotion} />,
    },
  ]
}

/** Promotions (docs/06 §4): codes and automatic offers, running ones first in mind. */
export function PromotionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("all")
  const list = useQuery(promotionsQuery())
  const columns = useColumns(list.data?.batch_counts ?? {})
  const all = list.data?.promotions ?? []
  const rows = tab === "all" ? all : all.filter((promotion) => tabOf(promotion) === tab)
  const add = (
    <Button asChild>
      <Link to="/promotions/new">
        <Plus />
        {t("promotions.add")}
      </Link>
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.promotions")}
        description={t("promotions.description")}
        action={add}
      />
      <PromotionsNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("promotions.views")}
          value={tab}
          onChange={setTab}
          tabs={TABS.map((key) => ({
            key,
            label: t(`promotions.tabs.${key}`),
            count: list.data
              ? key === "all"
                ? all.length
                : all.filter((row) => tabOf(row) === key).length
              : undefined,
          }))}
        />
        {list.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={list.data ? rows : undefined}
            rowKey={(promotion) => promotion.id}
            loading={list.isPending}
            onRowClick={(promotion) => {
              void navigate({ to: "/promotions/$id", params: { id: promotion.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <BadgePercent className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("promotions.empty")}</p>
                {tab === "all" ? add : null}
              </div>
            }
          />
        )}
      </section>
    </div>
  )
}
