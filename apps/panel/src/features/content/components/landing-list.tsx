import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { LayoutGrid } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { LANDING_PAGE_SIZE, landingsQuery } from "@/features/content/api/landings"
import type { Landing } from "@/features/content/api/landings"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { OriginalityBadge } from "@/features/content/components/originality-badge"
import { errorText } from "@/lib/errors"
import { formatDate } from "@qticaret/admin-ui/lib/format"

function useColumns(): Column<Landing>[] {
  const { t } = useTranslation()
  return [
    {
      key: "title",
      header: t("content.columns.title"),
      cell: (landing) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/content/landings/$id"
            params={{ id: landing.id }}
            className="truncate font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            {landing.title}
          </Link>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {landing.path ?? "—"}
          </span>
        </div>
      ),
    },
    {
      key: "originality",
      header: t("content.landing.originality"),
      cell: (landing) => <OriginalityBadge value={landing.originality} />,
    },
    {
      key: "status",
      header: t("content.columns.status"),
      cell: (landing) => <ContentStatusBadge status={landing.status} />,
    },
    {
      key: "updated",
      header: t("content.columns.updated"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (landing) => (
        <span className="text-muted-foreground tabular-nums">{formatDate(landing.updated_at)}</span>
      ),
    },
  ]
}

/** The landing pages, by title, with how much of their text is their own. */
export function LandingList({
  q,
  page,
  onPage,
  add,
}: {
  q: string
  page: number
  onPage: (page: number) => void
  add: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const list = useQuery(landingsQuery({ q, page }))
  const columns = useColumns()
  if (list.isError) {
    return (
      <div className="p-5">
        <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
      </div>
    )
  }
  return (
    <>
      <DataTable
        columns={columns}
        rows={list.data?.landings}
        rowKey={(landing) => landing.id}
        loading={list.isPending}
        stale={list.isPlaceholderData}
        onRowClick={(landing) => {
          void navigate({ to: "/content/landings/$id", params: { id: landing.id } })
        }}
        empty={
          <div className="flex flex-col items-center gap-3 text-center">
            <LayoutGrid className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {q ? t("content.noMatch") : t("content.empty.landing")}
            </p>
            {q ? null : add}
          </div>
        }
      />
      {list.data && list.data.count > LANDING_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={LANDING_PAGE_SIZE}
          count={list.data.count}
          onPageChange={onPage}
        />
      ) : null}
    </>
  )
}
