import { useQuery } from "@tanstack/react-query"
import { ArrowRight, MoreHorizontal, Pencil, Trash2, Waypoints } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { REDIRECT_PAGE_SIZE, redirectsQuery, useDeleteRedirect } from "@/features/seo/api/redirects"
import type { Redirect, RedirectMatch } from "@/features/seo/api/redirects"
import { errorText } from "@/lib/errors"
import { formatCount, formatRelative } from "@/lib/format"
import { formOf } from "./form"
import { RedirectDialog } from "./redirect-dialog"

export function SourceCell({ rule }: { rule: Redirect }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate font-mono text-[13px] font-medium" title={rule.source}>
        {rule.source}
        {rule.match === "prefix" ? <span className="text-muted-foreground">/*</span> : null}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {rule.match === "exact" ? null : (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {t(`seo.redirects.matches.${rule.match}`)}
          </span>
        )}
        {rule.shadowed ? (
          <StatusBadge tone="warning">{t("seo.redirects.shadowed")}</StatusBadge>
        ) : null}
      </span>
    </div>
  )
}

function useColumns(onEdit: (rule: Redirect) => void, onDelete: (rule: Redirect) => void) {
  const { t } = useTranslation()
  const columns: Column<Redirect>[] = [
    {
      key: "source",
      header: t("seo.redirects.columns.source"),
      cell: (rule) => <SourceCell rule={rule} />,
    },
    {
      key: "target",
      header: t("seo.redirects.columns.target"),
      cell: (rule) =>
        rule.target === null ? (
          <StatusBadge tone="neutral">{t("seo.redirects.gone")}</StatusBadge>
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-mono text-[13px]" title={rule.target}>
              {rule.target}
            </span>
          </span>
        ),
    },
    {
      key: "status",
      header: t("seo.redirects.columns.status"),
      className: "hidden md:table-cell",
      cell: (rule) => (
        <span className="text-muted-foreground tabular-nums">
          {t(`seo.redirects.statusShort.${String(rule.status)}`)}
        </span>
      ),
    },
    {
      key: "hits",
      header: t("seo.redirects.columns.hits"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (rule) => (
        <span className="flex flex-col items-end">
          <span className="tabular-nums">{formatCount(rule.hit_count)}</span>
          {rule.last_hit_at ? (
            <span className="text-xs text-muted-foreground">
              {formatRelative(rule.last_hit_at)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      align: "right",
      cell: (rule) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("common.actions")}
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <DropdownMenuItem
              onSelect={() => {
                onEdit(rule)
              }}
            >
              <Pencil />
              {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                onDelete(rule)
              }}
            >
              <Trash2 />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
  return columns
}

interface RulesTabProps {
  q: string
  page: number
  match: RedirectMatch | undefined
  onPage: (page: number) => void
  onAdd: () => void
}

/** The shop's rules, newest first: where each old address goes and how often it is asked for. */
export function RulesTab({ q, page, match, onPage, onAdd }: RulesTabProps) {
  const { t } = useTranslation()
  const list = useQuery(redirectsQuery({ q, page, ...(match ? { match } : {}) }))
  const remove = useDeleteRedirect()
  const [editing, setEditing] = useState<Redirect | null>(null)
  const [deleting, setDeleting] = useState<Redirect | null>(null)
  const columns = useColumns(setEditing, setDeleting)
  return (
    <>
      {list.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.redirects}
          rowKey={(rule) => rule.id}
          loading={list.isPending}
          stale={list.isPlaceholderData}
          onRowClick={setEditing}
          empty={
            <div className="flex flex-col items-center gap-3 text-center">
              <Waypoints className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {q || match ? t("seo.redirects.noMatch") : t("seo.redirects.empty")}
              </p>
              {q || match ? null : (
                <Button size="sm" onClick={onAdd}>
                  {t("seo.redirects.add")}
                </Button>
              )}
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
      <RedirectDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
        ruleId={editing?.id}
        initial={editing ? formOf(editing) : undefined}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
          }
        }}
        title={t("seo.redirects.deleteTitle")}
        description={t("seo.redirects.deleteText", { source: deleting?.source ?? "" })}
        confirmLabel={t("seo.redirects.deleteConfirm")}
        destructive
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onSuccess: () => toast.success(t("seo.redirects.deleted")),
              onError: (error) => toast.error(errorText(t, error)),
            })
          }
          setDeleting(null)
        }}
      />
    </>
  )
}
