import { useQuery } from "@tanstack/react-query"
import { UserPen } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { AUTHOR_PAGE_SIZE, authorsQuery } from "@/features/content/api/authors"
import type { Author } from "@/features/content/api/authors"
import { AuthorDialog } from "@/features/content/components/author-dialog"
import { errorText } from "@/lib/errors"

const A = "content.authors"

function useColumns(onOpen: (author: Author) => void): Column<Author>[] {
  const { t } = useTranslation()
  return [
    {
      key: "name",
      header: t(`${A}.columns.name`),
      cell: (author) => (
        <div className="flex min-w-0 items-center gap-3">
          {author.image_url ? (
            <img
              src={author.image_url}
              alt=""
              className="size-9 shrink-0 rounded-full border object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-medium text-muted-foreground"
            >
              {author.name.slice(0, 1).toLocaleUpperCase("tr")}
            </span>
          )}
          <div className="flex min-w-0 flex-col items-start">
            <button
              type="button"
              className="max-w-full truncate text-left font-medium hover:underline"
              onClick={(event) => {
                event.stopPropagation()
                onOpen(author)
              }}
            >
              {author.name}
            </button>
            <span className="max-w-full truncate font-mono text-xs text-muted-foreground">
              {author.path}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "job_title",
      header: t(`${A}.columns.jobTitle`),
      className: "hidden md:table-cell",
      cell: (author) => <span className="text-muted-foreground">{author.job_title ?? "—"}</span>,
    },
    {
      key: "posts",
      header: t(`${A}.columns.posts`),
      align: "right",
      cell: (author) => (
        <span className="flex flex-col items-end tabular-nums">
          <span>{author.post_count}</span>
          <span className="text-xs text-muted-foreground">
            {t("content.terms.live", { count: author.live_post_count })}
          </span>
        </span>
      ),
    },
  ]
}

/** A blog's authors by name, each opened in the standard dialog. */
export function AuthorList({
  q,
  page,
  onPage,
  add,
}: {
  q: string
  page: number
  onPage: (page: number) => void
  /** The page's "Yeni yazar", offered again in the empty list. */
  add: ReactNode
}) {
  const { t } = useTranslation()
  const list = useQuery(authorsQuery({ q, page }))
  const [opened, setOpened] = useState<Author | null>(null)
  const columns = useColumns(setOpened)
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
        rows={list.data?.authors}
        rowKey={(author) => author.id}
        loading={list.isPending}
        stale={list.isPlaceholderData}
        onRowClick={setOpened}
        empty={
          <div className="flex flex-col items-center gap-3 text-center">
            <UserPen className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {q ? t(`${A}.noMatch`) : t(`${A}.empty`)}
            </p>
            {q ? null : add}
          </div>
        }
      />
      {list.data && list.data.count > AUTHOR_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={AUTHOR_PAGE_SIZE}
          count={list.data.count}
          onPageChange={onPage}
        />
      ) : null}
      {opened ? (
        <AuthorDialog
          key={opened.id}
          // The list's copy once a save has refreshed it
          author={list.data?.authors.find((author) => author.id === opened.id) ?? opened}
          onClose={() => {
            setOpened(null)
          }}
        />
      ) : null}
    </>
  )
}
