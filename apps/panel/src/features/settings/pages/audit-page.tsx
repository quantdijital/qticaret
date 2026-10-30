import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import type { TFunction } from "i18next"
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
import { useStartJob } from "@/features/settings/api/activity"
import {
  AUDIT_KINDS,
  AUDIT_PAGE_SIZE,
  auditFilters,
  auditQuery,
  staffNamesQuery,
} from "@/features/settings/api/audit"
import type { AuditEntry, AuditSearch } from "@/features/settings/api/audit"
import { AuditDetailSheet } from "@/features/settings/components/audit-detail-sheet"
import { AuditFilters } from "@/features/settings/components/audit-filters"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"

const route = getRouteApi("/_auth/settings/audit")

const TONE: Record<AuditEntry["kind"], StatusTone> = {
  mutation: "info",
  sensitive_read: "warning",
  system: "neutral",
}

/**
 * Who an entry names: a person by name (one whose login is gone since, as
 * a former member), a key by its id, else the platform.
 */
function actorOf(entry: AuditEntry, staff: Map<string, string> | undefined, t: TFunction): string {
  if (entry.actor_type === "user" && entry.actor_id) {
    return (
      staff?.get(entry.actor_id) ?? (staff ? t("settings.audit.actors.former") : entry.actor_id)
    )
  }
  if (entry.actor_type === "api-key") {
    return `${t("settings.audit.actors.api-key")}${entry.actor_id ? ` · ${entry.actor_id}` : ""}`
  }
  return t("settings.audit.actors.system")
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
      // The tabs above say it on a phone
      className: "hidden sm:table-cell",
      cell: (entry) => (
        <StatusBadge tone={TONE[entry.kind]}>{t(`settings.audit.kinds.${entry.kind}`)}</StatusBadge>
      ),
    },
    {
      key: "action",
      header: t("settings.audit.columns.action"),
      cell: (entry) => (
        <div className="flex max-w-72 min-w-0 flex-col">
          <span className="truncate font-mono text-[12px]">{entry.action}</span>
          {entry.resource_type ? (
            <span className="truncate text-xs text-muted-foreground">
              {t(`settings.audit.resources.${entry.resource_type}`, {
                defaultValue: entry.resource_type,
              })}
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
      cell: (entry) => (
        <span className="block max-w-44 truncate text-[13px] text-muted-foreground">
          {actorOf(entry, staff, t)}
        </span>
      ),
    },
    {
      key: "ip",
      header: t("settings.audit.columns.ip"),
      align: "right",
      // In the entry's detail on narrower screens: the settings menu takes the room
      className: "hidden 2xl:table-cell",
      cell: (entry) => (
        <span className="font-mono text-[12px] text-muted-foreground">{entry.ip ?? "—"}</span>
      ),
    },
  ]
}

/**
 * Settings > Audit log (adr/0011, F12.5): who changed what and who read
 * personal data, newest first, by person, resource and day; an entry opens
 * in full beside the list. Reading this page is recorded too; the export
 * runs as a job with the same filters and its file waits on the Jobs page.
 */
export function AuditPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<AuditEntry | null>(null)
  const log = useQuery(auditQuery(search, page))
  const exportJob = useStartJob()
  const actorIds = [
    ...new Set(
      (log.data?.audit_entries ?? []).flatMap((entry) =>
        entry.actor_type === "user" && entry.actor_id ? [entry.actor_id] : []
      )
    ),
  ].sort()
  const staff = useQuery(staffNamesQuery(actorIds))
  const columns = useColumns(staff.data)
  const filtered = Object.keys(auditFilters(search)).length > 0

  const change = (next: Partial<AuditSearch>) => {
    setPage(0)
    void navigate({
      to: "/settings/audit",
      search: { ...search, ...next },
      replace: true,
    })
  }

  const startExport = () => {
    exportJob.mutate(
      { type: "audit_log.export", input: auditFilters(search) },
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
            {t(filtered ? "settings.audit.exportFiltered" : "settings.audit.export")}
          </Button>
        }
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t("settings.audit.views")}
          value={search.kind ?? "all"}
          onChange={(next) => {
            change({ kind: next === "all" ? undefined : next })
          }}
          tabs={AUDIT_KINDS.map((key) => ({
            key,
            label: key === "all" ? t("settings.audit.all") : t(`settings.audit.kinds.${key}`),
          }))}
        />
        <AuditFilters search={search} onChange={change} />
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
              onRowClick={setOpen}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <ScrollText className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {t(filtered ? "settings.audit.emptyFiltered" : "settings.audit.empty")}
                  </p>
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
      <AuditDetailSheet
        entry={open}
        actor={open ? actorOf(open, staff.data, t) : ""}
        onClose={() => {
          setOpen(null)
        }}
      />
    </div>
  )
}
