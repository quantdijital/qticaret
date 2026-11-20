import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { FileText, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PAGE_LAYOUT_LIMITS } from "@qticaret/types"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { CONTENT_PAGE_SIZE, contentListQuery } from "@/features/content/api/content"
import type { ContentEntry } from "@/features/content/api/content"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { layoutQuery } from "@/features/storefront/api/layout"
import { markJustMade } from "@/features/storefront/editor/just-made-page"
import { NewPageDialog } from "@/features/storefront/editor/new-page-dialog"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/storefront/pages")
const P = "storefront.pages"

function useColumns(): Column<ContentEntry>[] {
  const { t } = useTranslation()
  return [
    {
      key: "title",
      header: t("content.columns.title"),
      cell: (entry) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/storefront/editor"
            search={{ icerik: entry.id }}
            className="truncate font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            {entry.title}
          </Link>
          <span className="truncate font-mono text-xs text-muted-foreground">{entry.path}</span>
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
 * Vitrin > Sayfalar (adr/0073 Ek 2026-11-19 (2), Ek not 2026-11-20): the
 * shop's own pages, found by title and opened in the theme editor, where
 * they are written and set; "Yeni sayfa" opens one as a draft there.
 */
export function ContentPagesPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const [adding, setAdding] = useState(false)
  const list = useQuery(contentListQuery({ kind: "page", q, page }))
  const designed = useQuery(layoutQuery()).data?.draft.pages.length ?? 0
  const columns = useColumns()
  const setSearch = (next: { q?: string; page?: number }) => {
    const merged = { q, page: page + 1, ...next }
    void navigate({
      to: "/storefront/pages",
      search: {
        q: merged.q === "" ? undefined : merged.q,
        page: merged.page > 1 ? merged.page : undefined,
      },
      replace: true,
    })
  }
  const add = (
    <Button
      onClick={() => {
        setAdding(true)
      }}
    >
      <Plus />
      {t(`${P}.add`)}
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.pages")} description={t(`${P}.description`)} action={add} />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t(`${P}.search`)}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
          {designed >= PAGE_LAYOUT_LIMITS.pages ? (
            <p className="text-sm text-muted-foreground">
              {t(`${P}.full`, { max: PAGE_LAYOUT_LIMITS.pages })}
            </p>
          ) : null}
        </div>
        {list.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={list.data?.entries}
            rowKey={(entry) => entry.id}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            onRowClick={(entry) => {
              void navigate({ to: "/storefront/editor", search: { icerik: entry.id } })
            }}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t(q ? "content.noMatch" : `${P}.empty`)}
                </p>
                {q ? null : add}
              </div>
            }
          />
        )}
        {list.data && list.data.count > CONTENT_PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={CONTENT_PAGE_SIZE}
            count={list.data.count}
            onPageChange={(next) => {
              setSearch({ page: next + 1 })
            }}
          />
        ) : null}
      </section>
      <NewPageDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={(id) => {
          // Told in memory, not by the address (a written address must not empty a page)
          markJustMade(id)
          void navigate({ to: "/storefront/editor", search: { icerik: id } })
        }}
      />
    </div>
  )
}
