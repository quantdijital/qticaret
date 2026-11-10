import { useQuery } from "@tanstack/react-query"
import { History, Unlink } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { REDIRECT_PAGE_SIZE, oldPathsQuery, useReleasePath } from "@/features/seo/api/redirects"
import type { OldPath } from "@/features/seo/api/redirects"
import { errorText } from "@/lib/errors"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { AnswerBadge } from "./answer-badge"

function useColumns(onRelease: (path: OldPath) => void): Column<OldPath>[] {
  const { t } = useTranslation()
  return [
    {
      key: "path",
      header: t("seo.redirects.columns.oldPath"),
      cell: (row) => (
        <span className="block truncate font-mono text-[13px] font-medium" title={row.path}>
          {row.path}
        </span>
      ),
    },
    {
      key: "owner",
      header: t("seo.redirects.columns.owner"),
      className: "hidden md:table-cell",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{row.name ?? "—"}</span>
          <span className="text-xs text-muted-foreground">
            {t(`seo.redirects.owners.${row.entity_type}`, { defaultValue: row.entity_type })}
            {row.deleted ? ` · ${t("seo.redirects.ownerDeleted")}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "answer",
      header: t("seo.redirects.columns.now"),
      cell: (row) => <AnswerBadge answer={row.answer} location={row.location} />,
    },
    {
      key: "since",
      header: t("seo.redirects.columns.since"),
      className: "hidden lg:table-cell",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">{formatDate(row.since)}</span>
      ),
    },
    {
      key: "release",
      header: <span className="sr-only">{t("seo.redirects.release")}</span>,
      align: "right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onRelease(row)
          }}
        >
          <Unlink />
          <span className="hidden sm:inline">{t("seo.redirects.release")}</span>
        </Button>
      ),
    },
  ]
}

/**
 * Addresses products, categories and collections used before (a new slug,
 * a move, a deletion), kept so their visitors still arrive: each goes to
 * the record's address now, its successor, or answers 410 (docs/13 §2.4).
 */
export function OldPathsTab({
  q,
  page,
  onPage,
}: {
  q: string
  page: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  const list = useQuery(oldPathsQuery({ q, page }))
  const release = useReleasePath()
  const [releasing, setReleasing] = useState<OldPath | null>(null)
  const columns = useColumns(setReleasing)
  return (
    <>
      <p className="border-b px-5 py-3 text-[13px] text-muted-foreground">
        {t("seo.redirects.oldHint")}
      </p>
      {list.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.paths}
          rowKey={(row) => row.path}
          loading={list.isPending}
          stale={list.isPlaceholderData}
          empty={
            <div className="flex flex-col items-center gap-3 text-center">
              <History className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {q ? t("seo.redirects.noMatch") : t("seo.redirects.oldEmpty")}
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
      <ConfirmDialog
        open={releasing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReleasing(null)
          }
        }}
        title={t("seo.redirects.releaseTitle")}
        description={t("seo.redirects.releaseText", { path: releasing?.path ?? "" })}
        confirmLabel={t("seo.redirects.releaseConfirm")}
        destructive
        onConfirm={() => {
          if (releasing) {
            release.mutate(releasing.path, {
              onSuccess: () => toast.success(t("seo.redirects.released")),
              onError: (error) => toast.error(errorText(t, error)),
            })
          }
          setReleasing(null)
        }}
      />
    </>
  )
}
