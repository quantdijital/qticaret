import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { LINES_PAGE_SIZE, linesQuery } from "@/features/wholesale/api/tiers"
import type { ListOwner, WholesaleLine } from "@/features/wholesale/api/types"
import { errorText } from "@/lib/errors"
import { formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"
import { LinesSummary } from "./lines-summary"
import { PriceLineDialog } from "./price-line-dialog"

const P = "wholesale.prices"

const money = (amount: string | null) => (amount === null ? "—" : formatMoney(amount, "try"))

function useLineColumns(): Column<WholesaleLine>[] {
  const { t } = useTranslation()
  return [
    {
      key: "product",
      header: t(`${P}.columns.product`),
      cell: (line) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb src={line.thumbnail} className="size-8" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{line.product_title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {[line.variant_title, line.sku].filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "retail",
      header: t(`${P}.columns.retail`),
      align: "right",
      className: "hidden md:table-cell",
      cell: (line) => (
        <span className="text-muted-foreground tabular-nums">{money(line.retail_now)}</span>
      ),
    },
    {
      key: "net",
      header: t(`${P}.columns.net`),
      align: "right",
      cell: (line) => <span className="font-medium tabular-nums">{money(line.net)}</span>,
    },
    {
      key: "gross",
      header: t(`${P}.columns.gross`),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (line) => (
        <span className="text-muted-foreground tabular-nums">{money(line.gross)}</span>
      ),
    },
    {
      key: "source",
      header: t(`${P}.columns.source`),
      cell: (line) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={line.source === "manual" ? "info" : "neutral"}>
            {t(`${P}.source.${line.source}`)}
          </StatusBadge>
          {line.undercut ? <StatusBadge tone="warning">{t(`${P}.undercut`)}</StatusBadge> : null}
        </div>
      ),
    },
  ]
}

type Editing = { line: WholesaleLine } | { variant: PickerOption | null }

/**
 * A wholesale list's prices (ADR-0068 §4), shared by a level's page and a
 * wholesaler's own: each variant's retail price now beside its wholesale
 * price, KDV excluded (entered) and included (information), by the rate
 * or by hand. A click opens the line's window; retail cheaper than
 * wholesale is a warning, never a block.
 */
export function PriceLinesCard({
  owner,
  percent,
  syncing,
}: {
  owner: ListOwner
  /** The list's rate, for the empty state's words. */
  percent: number | null
  /** The rate's rows are still being written. */
  syncing: boolean
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Editing | null>(null)
  const lines = useQuery(linesQuery(owner, { q, page }))
  const columns = useLineColumns()
  const add = (variant: PickerOption | null = null) => {
    setEditing({ variant })
  }
  const data = lines.data
  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(`${P}.hint`)}
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            add()
          }}
        >
          <Plus />
          {t(`${P}.add`)}
        </Button>
      }
      flush
    >
      {data ? <LinesSummary page={data} syncing={syncing} onPrice={add} /> : null}
      <div className="flex flex-wrap items-center gap-3 border-t px-5 py-3">
        <SearchInput
          value={q}
          placeholder={t(`${P}.search`)}
          onChange={(text) => {
            setQ(text)
            setPage(0)
          }}
        />
        {data ? (
          <span className="text-[13px] text-muted-foreground">
            {t(`${P}.count`, { count: data.count, formatted: formatCount(data.count) })}
          </span>
        ) : null}
      </div>
      {lines.isError && !data ? (
        <div className="border-t px-5 py-4">
          <ErrorState text={errorText(t, lines.error)} onRetry={() => void lines.refetch()} />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.lines}
            rowKey={(line) => line.variant_id}
            loading={lines.isPending}
            stale={lines.isPlaceholderData}
            onRowClick={(line) => {
              setEditing({ line })
            }}
            empty={
              <p className="text-sm text-muted-foreground">
                {q
                  ? t(`${P}.noMatch`)
                  : t(percent === null ? `${P}.emptyManual` : `${P}.emptyRate`)}
              </p>
            }
          />
          {data && data.count > LINES_PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={LINES_PAGE_SIZE}
              count={data.count}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
      {editing ? (
        <PriceLineDialog
          key={"line" in editing ? editing.line.variant_id : (editing.variant?.id ?? "new")}
          owner={owner}
          line={"line" in editing ? editing.line : null}
          variant={"variant" in editing ? editing.variant : null}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null)
            }
          }}
        />
      ) : null}
    </SectionCard>
  )
}
