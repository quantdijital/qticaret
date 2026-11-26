import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { FileText } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { CONTENT_PAGE_SIZE, contentListQuery } from "@/features/content/api/content"
import type { ContentEntry, ContentKind } from "@/features/content/api/content"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { TermBadges } from "@/features/content/components/term-badges"
import { errorText } from "@/lib/errors"
import { formatDate } from "@qticaret/admin-ui/lib/format"

function useColumns(): Column<ContentEntry>[] {
  const { t } = useTranslation()
  return [
    {
      key: "title",
      header: t("content.columns.title"),
      fill: true,
      cell: (entry) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/content/$id"
            params={{ id: entry.id }}
            title={entry.title}
            className="truncate font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            {entry.title}
          </Link>
          <span className="truncate font-mono text-xs text-muted-foreground">{entry.path}</span>
          {entry.kind === "post" ? (
            <TermBadges category={entry.category} tags={entry.tags} />
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: t("content.columns.status"),
      cell: (entry) => <ContentStatusBadge status={entry.status} />,
    },
    {
      key: "updated",
      header: t("content.columns.updated"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (entry) => (
        <span className="text-muted-foreground tabular-nums">{formatDate(entry.updated_at)}</span>
      ),
    },
  ]
}

/**
 * The blog's posts, newest change first, each with its category and tags
 * (the shop's pages are the theme editor's, adr/0073 Ek 2026-11-19 (2) K5).
 */
export function EntryList({
  kind,
  q,
  page,
  onPage,
  add,
}: {
  kind: ContentKind
  q: string
  page: number
  onPage: (page: number) => void
  add: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const list = useQuery(contentListQuery({ kind, q, page }))
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
        rows={list.data?.entries}
        rowKey={(entry) => entry.id}
        loading={list.isPending}
        stale={list.isPlaceholderData}
        onRowClick={(entry) => {
          void navigate({ to: "/content/$id", params: { id: entry.id } })
        }}
        empty={
          <div className="flex flex-col items-center gap-3 text-center">
            <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {q ? t("content.noMatch") : t(`content.empty.${kind}`)}
            </p>
            {q ? null : add}
          </div>
        }
      />
      {list.data && list.data.count > CONTENT_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={CONTENT_PAGE_SIZE}
          count={list.data.count}
          onPageChange={onPage}
        />
      ) : null}
    </>
  )
}
