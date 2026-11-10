import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Plus, Tags } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { priceListsQuery } from "@/features/price-lists/api/price-lists"
import type { PriceList } from "@/features/price-lists/api/price-lists"
import { ListBadge } from "@/features/price-lists/components/list-badge"
import { PromotionsNav } from "@/features/promotions/components/promotions-nav"
import { listSchedule, valuesOf } from "@/features/price-lists/form"
import { errorText } from "@/lib/errors"
import { formatCount, formatDate } from "@qticaret/admin-ui/lib/format"

const TABS = ["all", "active", "scheduled", "draft", "ended"] as const
type Tab = (typeof TABS)[number]

const tabOf = (list: PriceList): Exclude<Tab, "all"> => {
  const schedule = listSchedule(list)
  return schedule === "inactive" ? "ended" : schedule
}

function useColumns(): Column<PriceList>[] {
  const { t } = useTranslation()
  return [
    {
      key: "title",
      header: t("priceLists.columns.title"),
      cell: (list) => (
        <Link
          to="/promotions/price-lists/$id"
          params={{ id: list.id }}
          className="font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {list.title}
        </Link>
      ),
    },
    {
      key: "type",
      header: t("priceLists.columns.type"),
      cell: (list) => (
        <span className="text-muted-foreground">
          {t(`priceLists.types.${list.type === "override" ? "override" : "sale"}`)}
        </span>
      ),
    },
    {
      key: "audience",
      header: t("priceLists.columns.audience"),
      className: "hidden md:table-cell",
      cell: (list) => {
        const { groups } = valuesOf(list)
        return (
          <span className="text-muted-foreground">
            {groups.length > 0
              ? t("priceLists.groupCount", { count: groups.length })
              : t("priceLists.audiences.everyone")}
          </span>
        )
      },
    },
    {
      key: "prices",
      header: t("priceLists.columns.prices"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (list) => <span className="tabular-nums">{formatCount(list.prices.length)}</span>,
    },
    {
      key: "dates",
      header: t("priceLists.columns.dates"),
      className: "hidden lg:table-cell",
      cell: (list) => (
        <span className="text-muted-foreground tabular-nums">
          {list.starts_at || list.ends_at
            ? `${list.starts_at ? formatDate(list.starts_at) : "…"} – ${list.ends_at ? formatDate(list.ends_at) : "…"}`
            : t("priceLists.noDates")}
        </span>
      ),
    },
    {
      key: "status",
      header: t("priceLists.columns.status"),
      align: "right",
      cell: (list) => <ListBadge list={list} />,
    },
  ]
}

/** Price lists (F4.1): sales shown struck through, and prices of their own for groups. */
export function PriceListsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("all")
  const list = useQuery(priceListsQuery())
  const columns = useColumns()
  const all = list.data ?? []
  const rows = tab === "all" ? all : all.filter((row) => tabOf(row) === tab)
  const add = (
    <Button asChild>
      <Link to="/promotions/price-lists/new">
        <Plus />
        {t("priceLists.add")}
      </Link>
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.promotions")}
        description={t("priceLists.description")}
        action={add}
      />
      <PromotionsNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("priceLists.views")}
          value={tab}
          onChange={setTab}
          tabs={TABS.map((key) => ({
            key,
            label: t(`priceLists.tabs.${key}`),
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
            rowKey={(row) => row.id}
            loading={list.isPending}
            onRowClick={(row) => {
              void navigate({ to: "/promotions/price-lists/$id", params: { id: row.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <Tags className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("priceLists.empty")}</p>
                {tab === "all" ? add : null}
              </div>
            }
          />
        )}
      </section>
    </div>
  )
}
