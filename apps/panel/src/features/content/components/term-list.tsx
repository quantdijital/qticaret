import { useQuery } from "@tanstack/react-query"
import { Folder, Hash } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { useRecordWalk } from "@/components/patterns/use-record-walk"
import { TERM_PAGE_SIZE, termsQuery } from "@/features/content/api/terms"
import type { Term, TermKind } from "@/features/content/api/terms"
import { TermDialog } from "@/features/content/components/term-dialog"
import { errorText } from "@/lib/errors"

const T = "content.terms"

function useColumns(onOpen: (term: Term) => void): Column<Term>[] {
  const { t } = useTranslation()
  return [
    {
      key: "name",
      header: t(`${T}.columns.name`),
      cell: (term) => (
        <div className="flex min-w-0 flex-col items-start">
          <button
            type="button"
            className="max-w-full truncate text-left font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              onOpen(term)
            }}
          >
            {term.name}
          </button>
          <span className="max-w-full truncate font-mono text-xs text-muted-foreground">
            {term.path}
          </span>
        </div>
      ),
    },
    {
      key: "posts",
      header: t(`${T}.columns.posts`),
      align: "right",
      cell: (term) => (
        <span className="flex flex-col items-end tabular-nums">
          <span>{term.post_count}</span>
          <span className="text-xs text-muted-foreground">
            {t(`${T}.live`, { count: term.live_post_count })}
          </span>
        </span>
      ),
    },
    {
      key: "rank",
      header: t(`${T}.columns.rank`),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (term) => <span className="text-muted-foreground tabular-nums">{term.rank}</span>,
    },
  ]
}

/** A blog's categories or tags in the shop's order, each opened in a dialog. */
export function TermList({
  kind,
  q,
  page,
  onPage,
}: {
  kind: TermKind
  q: string
  page: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  const list = useQuery(termsQuery({ kind, q, page }))
  const walk = useRecordWalk(list.data?.terms, (term) => term.id)
  const columns = useColumns(walk.show)
  const Icon = kind === "category" ? Folder : Hash
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
        rows={list.data?.terms}
        rowKey={(term) => term.id}
        loading={list.isPending}
        stale={list.isPlaceholderData}
        onRowClick={walk.show}
        empty={
          <div className="flex flex-col items-center gap-3 text-center">
            <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {q ? t(`${T}.noMatch`) : t(`${T}.empty.${kind}`)}
            </p>
          </div>
        }
      />
      {list.data && list.data.count > TERM_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={TERM_PAGE_SIZE}
          count={list.data.count}
          onPageChange={onPage}
        />
      ) : null}
      {walk.open ? (
        // The list's copy once a save has refreshed it
        <TermDialog term={walk.open} steps={walk.steps} onClose={walk.close} />
      ) : null}
    </>
  )
}
