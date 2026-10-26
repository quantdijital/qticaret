import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Loader2, PackageSearch } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  STOCK_PAGE_SIZE,
  STOCK_VIEWS,
  stockBoardQuery,
  useSetStock,
} from "@/features/inventory/api/stock"
import type { StockItem, StockView } from "@/features/inventory/api/stock"
import { NoLocationNotice } from "@/features/inventory/components/no-location-notice"
import { shopDefaultsQuery } from "@/features/products/api/lookups"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

const route = getRouteApi("/_auth/inventory")
const DIGITS = /^\d{1,7}$/

type Drafts = Record<string, string>

function AvailableBadge({ available, threshold }: { available: number; threshold: number }) {
  const { t } = useTranslation()
  return available <= 0 ? (
    <StatusBadge tone="danger">{t("inventory.out")}</StatusBadge>
  ) : available <= threshold ? (
    <StatusBadge tone="warning">{t("inventory.lowCount", { count: available })}</StatusBadge>
  ) : (
    <span className="tabular-nums">{formatCount(available)}</span>
  )
}

function useColumns(
  locationId: string | null,
  threshold: number,
  drafts: Drafts,
  setDraft: (id: string, text: string) => void
): Column<StockItem>[] {
  const { t } = useTranslation()
  const shelf = (item: StockItem) => item.levels.find((level) => level.location_id === locationId)
  return [
    {
      key: "item",
      header: t("inventory.columns.item"),
      cell: (item) => {
        const product = item.variant?.product
        return (
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb src={product?.thumbnail} />
            {/* Capped on phones so long codes truncate instead of pushing the shelf field off screen */}
            <div className="flex max-w-[8.5rem] min-w-0 flex-col sm:max-w-xs">
              {product ? (
                <Link
                  to="/products/$id"
                  params={{ id: product.id }}
                  className="truncate font-medium hover:underline"
                >
                  {product.title}
                </Link>
              ) : (
                <span className="truncate font-medium">{item.title ?? "—"}</span>
              )}
              <span className="truncate text-xs text-muted-foreground">
                {[item.variant?.title, item.sku].filter(Boolean).join(" · ")}
              </span>
              {/* On phones sellable stock sits here; its own column comes back from sm up */}
              <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
                {t("inventory.columns.available")}
                <AvailableBadge available={item.available} threshold={threshold} />
              </span>
            </div>
          </div>
        )
      },
    },
    {
      key: "available",
      header: t("inventory.columns.available"),
      className: "hidden sm:table-cell",
      cell: (item) => <AvailableBadge available={item.available} threshold={threshold} />,
    },
    {
      key: "reserved",
      header: t("inventory.columns.reserved"),
      align: "right",
      className: "hidden md:table-cell",
      cell: (item) => (
        <span className="text-muted-foreground tabular-nums">
          {formatCount(item.levels.reduce((sum, level) => sum + level.reserved_quantity, 0))}
        </span>
      ),
    },
    {
      key: "shelf",
      header: t("inventory.columns.shelf"),
      align: "right",
      cell: (item) => {
        const current = String(shelf(item)?.stocked_quantity ?? 0)
        const text = drafts[item.id] ?? current
        const invalid = !DIGITS.test(text)
        return (
          <Input
            value={text}
            inputMode="numeric"
            aria-label={t("inventory.shelfOf", {
              name: item.variant?.product?.title ?? item.sku ?? item.id,
            })}
            aria-invalid={invalid || undefined}
            className={cn(
              "ml-auto h-8 w-20 text-right tabular-nums sm:w-24",
              drafts[item.id] !== undefined && drafts[item.id] !== current && "border-primary"
            )}
            onClick={(event) => {
              event.stopPropagation()
            }}
            onChange={(event) => {
              setDraft(item.id, event.target.value.trim())
            }}
          />
        )
      },
    },
  ]
}

/** Stock (docs/06 §4): what is running out first, shelf counts edited in place and saved together. */
export function InventoryPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const view = search.view ?? "all"
  const page = (search.page ?? 1) - 1
  const q = search.q ?? ""
  const board = useQuery(stockBoardQuery({ view, q, page }))
  const defaults = useQuery(shopDefaultsQuery())
  const save = useSetStock()
  // Drafts belong to the list on screen: another view, search or page starts clean,
  // and leaving with unsaved counts asks first
  const listKey = `${view}|${q}|${String(page)}`
  const [draftState, setDraftState] = useState<{ key: string; values: Drafts }>({
    key: listKey,
    values: {},
  })
  const drafts = draftState.key === listKey ? draftState.values : {}
  const setDrafts = (next: Drafts | ((was: Drafts) => Drafts)) => {
    setDraftState((was) => {
      const current = was.key === listKey ? was.values : {}
      return { key: listKey, values: typeof next === "function" ? next(current) : next }
    })
  }
  const locationId = defaults.data?.locationId ?? null
  const items = board.data?.items ?? []
  const shelf = (item: StockItem) => item.levels.find((level) => level.location_id === locationId)
  const changed = items.filter((item) => {
    const text = drafts[item.id]
    return text !== undefined && text !== String(shelf(item)?.stocked_quantity ?? 0)
  })
  const invalid = changed.some((item) => !DIGITS.test(drafts[item.id] ?? ""))
  const columns = useColumns(locationId, board.data?.threshold ?? 5, drafts, (id, text) => {
    setDrafts((was) => ({ ...was, [id]: text }))
  })
  const setSearch = (next: { q?: string; view?: StockView; page?: number }) => {
    const nextView = next.view ?? view
    void navigate({
      to: "/inventory",
      search: {
        q: (next.q ?? q) || undefined,
        view: nextView === "all" ? undefined : nextView,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  const submit = () => {
    if (!locationId) {
      return
    }
    save.mutate(
      {
        locationId,
        edits: changed.map((item) => ({
          inventoryItemId: item.id,
          quantity: Number(drafts[item.id]),
          hasLevel: Boolean(shelf(item)),
        })),
      },
      {
        onSuccess: () => {
          setDrafts({})
          toast.success(t("inventory.saved", { count: changed.length }))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <LeaveGuard when={changed.length > 0 && !save.isPending} />
      <PageHeader title={t("nav.inventory")} description={t("inventory.description")} />
      {defaults.isSuccess && !locationId ? <NoLocationNotice /> : null}
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("inventory.views")}
          value={view}
          onChange={(next) => {
            setSearch({ view: next, page: 1 })
          }}
          tabs={STOCK_VIEWS.map((key) => ({
            key,
            label: t(`inventory.tabs.${key}`, { threshold: board.data?.threshold ?? 5 }),
            count: board.data?.counts[key],
          }))}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("inventory.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          {changed.length > 0 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  setDrafts({})
                }}
              >
                {t("common.reset")}
              </Button>
              <Button
                size="sm"
                disabled={save.isPending || invalid || !locationId}
                onClick={submit}
              >
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                {t("inventory.save", { count: changed.length })}
              </Button>
            </div>
          ) : null}
        </div>
        {board.isError ? (
          <div className="px-5 pb-5">
            <ErrorState text={errorText(t, board.error)} onRetry={() => void board.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={board.data?.items}
              rowKey={(item) => item.id}
              loading={board.isPending}
              stale={board.isPlaceholderData}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {q ? t("inventory.noMatch") : t(`inventory.empty.${view}`)}
                  </p>
                </div>
              }
            />
            {board.data && board.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={STOCK_PAGE_SIZE}
                count={board.data.count}
                onPageChange={(next) => {
                  setSearch({ page: next + 1 })
                }}
              />
            ) : null}
          </>
        )}
      </section>
      <p className="text-xs text-muted-foreground">{t("inventory.note")}</p>
    </div>
  )
}
