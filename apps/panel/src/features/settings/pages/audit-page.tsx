import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { FileDown, ScrollText } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  AUDIT_KINDS,
  AUDIT_PAGE_SIZE,
  auditQuery,
  staffQuery,
  useStartJob,
} from "@/features/settings/api/activity"
import type { AuditEntry, AuditKind } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"

const TONE: Record<AuditEntry["kind"], StatusTone> = {
  mutation: "info",
  sensitive_read: "warning",
  system: "neutral",
}

function useColumns(staff: Map<string, string> | undefined): Column<AuditEntry>[] {
  const { t } = useTranslation()
  return [
    {
      key: "when",
      header: t("settings.audit.columns.when"),
      cell: (entry) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(entry.created_at)}
        </span>
      ),
    },
    {
      key: "kind",
      header: t("settings.audit.columns.kind"),
      cell: (entry) => (
        <StatusBadge tone={TONE[entry.kind]}>{t(`settings.audit.kinds.${entry.kind}`)}</StatusBadge>
      ),
    },
    {
      key: "action",
      header: t("settings.audit.columns.action"),
      cell: (entry) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-[12px]">{entry.action}</span>
          {entry.resource_type ? (
            <span className="truncate text-xs text-muted-foreground">
              {entry.resource_type}
              {entry.resource_id ? ` · ${entry.resource_id}` : ""}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "actor",
      header: t("settings.audit.columns.actor"),
      className: "hidden lg:table-cell",
      cell: (entry) => {
        const name = entry.actor_id ? staff?.get(entry.actor_id) : undefined
        if (name) {
          return <span className="text-[13px] text-muted-foreground">{name}</span>
        }
        return (
          <span className="font-mono text-[12px] text-muted-foreground">
            {entry.actor_id ??
              t(`settings.audit.actors.${entry.actor_type ?? "system"}`, { defaultValue: "—" })}
          </span>
        )
      },
    },
    {
      key: "ip",
      header: t("settings.audit.columns.ip"),
      align: "right",
      className: "hidden md:table-cell",
      cell: (entry) => (
        <span className="font-mono text-[12px] text-muted-foreground">{entry.ip ?? "—"}</span>
      ),
    },
  ]
}

/**
 * Settings > Audit log (adr/0011): who changed what and who read personal
 * data, newest first. Reading this page is recorded too; the export runs
 * as a job and its file waits on the Jobs page.
 */
export function AuditPage() {
  const { t } = useTranslation()
  const [kind, setKind] = useState<AuditKind>("all")
  const [page, setPage] = useState(0)
  const log = useQuery(auditQuery({ kind, page }))
  const exportJob = useStartJob()
  const navigate = useNavigate()
  const actorIds = [
    ...new Set(
      (log.data?.audit_entries ?? []).flatMap((entry) =>
        entry.actor_type === "user" && entry.actor_id ? [entry.actor_id] : []
      )
    ),
  ].sort()
  const staff = useQuery(staffQuery(actorIds))
  const columns = useColumns(staff.data)

  const startExport = () => {
    exportJob.mutate(
      { type: "audit_log.export", input: kind === "all" ? {} : { kind } },
      {
        onSuccess: () =>
          toast.success(t("settings.audit.exportStarted"), {
            action: {
              label: t("settings.audit.openJobs"),
              onClick: () => {
                void navigate({ to: "/settings/jobs" })
              },
            },
          }),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.audit.title")}
        description={t("settings.audit.subtitle")}
        action={
          <Button variant="outline" disabled={exportJob.isPending} onClick={startExport}>
            <FileDown />
            {t("settings.audit.export")}
          </Button>
        }
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("settings.audit.views")}
          value={kind}
          onChange={(next) => {
            setKind(next)
            setPage(0)
          }}
          tabs={AUDIT_KINDS.map((key) => ({
            key,
            label: key === "all" ? t("settings.audit.all") : t(`settings.audit.kinds.${key}`),
          }))}
        />
        {log.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, log.error)} onRetry={() => void log.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={log.data?.audit_entries}
              rowKey={(entry) => entry.id}
              loading={log.isPending}
              stale={log.isPlaceholderData}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <ScrollText className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t("settings.audit.empty")}</p>
                </div>
              }
            />
            {log.data && log.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={AUDIT_PAGE_SIZE}
                count={log.data.count}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        {t("settings.audit.retention")}{" "}
        <Link to="/settings/jobs" className="underline">
          {t("settings.audit.openJobs")}
        </Link>
      </p>
    </div>
  )
}
