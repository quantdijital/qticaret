import { useQuery } from "@tanstack/react-query"
import { Plus, SearchX, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  REDIRECT_PAGE_SIZE,
  notFoundQuery,
  useDismissNotFound,
  useSaveRedirect,
} from "@/features/seo/api/redirects"
import type { NotFoundEntry } from "@/features/seo/api/redirects"
import { errorText } from "@/lib/errors"
import { formatCount, formatRelative } from "@qticaret/admin-ui/lib/format"
import { AnswerBadge } from "./answer-badge"

interface Actions {
  onRedirect: (entry: NotFoundEntry, target: string) => void
  onOpenForm: (entry: NotFoundEntry) => void
  onDismiss: (entry: NotFoundEntry) => void
  busy: boolean
}

function Fix({ entry, onRedirect, onOpenForm, busy }: { entry: NotFoundEntry } & Actions) {
  const { t } = useTranslation()
  if (entry.answer !== "not_found") {
    return <AnswerBadge answer={entry.answer} location={entry.location} />
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entry.suggestions.map((suggestion) => (
        <Button
          key={suggestion.path}
          variant="outline"
          size="sm"
          disabled={busy}
          className="h-7 max-w-full font-mono text-xs"
          title={t("seo.redirects.oneClick", { target: suggestion.path })}
          onClick={() => {
            onRedirect(entry, suggestion.path)
          }}
        >
          <span className="truncate">→ {suggestion.path}</span>
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => {
          onOpenForm(entry)
        }}
      >
        <Plus />
        {t(entry.suggestions.length ? "seo.redirects.otherTarget" : "seo.redirects.addFor")}
      </Button>
    </div>
  )
}

function useColumns(actions: Actions): Column<NotFoundEntry>[] {
  const { t } = useTranslation()
  return [
    {
      key: "path",
      header: t("seo.redirects.columns.missingPath"),
      cell: (entry) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-[13px] font-medium" title={entry.path}>
            {entry.path}
          </span>
          {entry.last_referer_host ? (
            <span className="truncate text-xs text-muted-foreground">
              {t("seo.redirects.from", { host: entry.last_referer_host })}
            </span>
          ) : null}
          {/* Phones have no room for the fix column: it comes under the path */}
          <span className="mt-2 md:hidden">
            <Fix entry={entry} {...actions} />
          </span>
        </span>
      ),
    },
    {
      key: "hits",
      header: t("seo.redirects.columns.asked"),
      align: "right",
      cell: (entry) => (
        <span className="flex flex-col items-end">
          <span className="tabular-nums">{formatCount(entry.hits)}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelative(entry.last_seen_at)}
          </span>
        </span>
      ),
    },
    {
      key: "fix",
      header: t("seo.redirects.columns.fix"),
      className: "hidden min-w-[14rem] md:table-cell",
      cell: (entry) => <Fix entry={entry} {...actions} />,
    },
    {
      key: "dismiss",
      header: <span className="sr-only">{t("seo.redirects.dismiss")}</span>,
      align: "right",
      cell: (entry) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("seo.redirects.dismiss")}
          title={t("seo.redirects.dismiss")}
          onClick={() => {
            actions.onDismiss(entry)
          }}
        >
          <X />
        </Button>
      ),
    },
  ]
}

/**
 * The 404 log (docs/13 §4): addresses visitors asked for and did not
 * find, most asked first, with likely pages to send them to in one click.
 */
export function NotFoundTab({
  q,
  page,
  onPage,
  onOpenForm,
}: {
  q: string
  page: number
  onPage: (page: number) => void
  onOpenForm: (entry: NotFoundEntry) => void
}) {
  const { t } = useTranslation()
  const list = useQuery(notFoundQuery({ q, page }))
  const save = useSaveRedirect()
  const dismiss = useDismissNotFound()
  const columns = useColumns({
    busy: save.isPending,
    onOpenForm,
    onRedirect: (entry, target) => {
      save.mutate(
        {
          rule: {
            match: "exact",
            source: entry.path,
            target,
            status: 301,
            query_policy: "keep",
            query_keep: [],
          },
        },
        {
          onSuccess: () => {
            toast.success(t("seo.redirects.form.created"))
            dismiss.mutate(entry.id)
          },
          onError: (error) => toast.error(errorText(t, error)),
        }
      )
    },
    onDismiss: (entry) => {
      dismiss.mutate(entry.id, { onError: (error) => toast.error(errorText(t, error)) })
    },
  })
  return (
    <>
      <p className="border-b px-5 py-3 text-[13px] text-muted-foreground">
        {t("seo.redirects.missingHint")}
      </p>
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
          empty={
            <div className="flex flex-col items-center gap-3 text-center">
              <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {q ? t("seo.redirects.noMatch") : t("seo.redirects.missingEmpty")}
              </p>
            </div>
          }
        />
      )}
      {list.data && list.data.count > REDIRECT_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={REDIRECT_PAGE_SIZE}
          count={list.data.count}
          onPageChange={(next) => {
            onPage(next + 1)
          }}
        />
      ) : null}
    </>
  )
}
