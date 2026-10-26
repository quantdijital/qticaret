import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { FileText, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { CONTENT_PAGE_SIZE, CONTENT_TABS, contentListQuery } from "@/features/content/api/content"
import type { ContentEntry, ContentKind, ContentTab } from "@/features/content/api/content"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { LandingList } from "@/features/content/components/landing-list"
import { NewLandingDialog } from "@/features/content/components/new-landing-dialog"
import { NewContentDialog } from "@/features/content/components/new-content-dialog"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"

const route = getRouteApi("/_auth/content/")

function useColumns(): Column<ContentEntry>[] {
  const { t } = useTranslation()
  return [
    {
      key: "title",
      header: t("content.columns.title"),
      cell: (entry) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/content/$id"
            params={{ id: entry.id }}
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

/** Content pages and blog posts (F3.16, docs/06): the shop's own pages and its blog. */
export function ContentListPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const tab: ContentTab = search.kind ?? "page"
  // The list of pages or posts; landing pages have their own
  const kind: ContentKind = tab === "landing" ? "page" : tab
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const list = useQuery({ ...contentListQuery({ kind, q, page }), enabled: tab !== "landing" })
  const columns = useColumns()
  const [adding, setAdding] = useState(false)
  const setSearch = (next: { kind?: ContentTab; q?: string; page?: number }) => {
    const merged = { kind: tab, q, page: page + 1, ...next }
    void navigate({
      to: "/content",
      search: {
        kind: merged.kind === "page" ? undefined : merged.kind,
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
      {t(`content.add.${tab}`)}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.content")} description={t("content.description")} action={add} />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("content.kinds")}
          value={tab}
          onChange={(next) => {
            setSearch({ kind: next, q: "", page: 1 })
          }}
          tabs={CONTENT_TABS.map((key) => ({ key, label: t(`content.tabs.${key}`) }))}
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("content.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
        </div>
        {tab === "landing" ? (
          <LandingList
            q={q}
            page={page}
            onPage={(next) => {
              setSearch({ page: next + 1 })
            }}
            add={add}
          />
        ) : list.isError ? (
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
        )}
        {tab !== "landing" && list.data && list.data.count > CONTENT_PAGE_SIZE ? (
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
      {tab === "landing" ? (
        <NewLandingDialog open={adding} onOpenChange={setAdding} />
      ) : (
        <NewContentDialog kind={kind} open={adding} onOpenChange={setAdding} />
      )}
    </div>
  )
}
