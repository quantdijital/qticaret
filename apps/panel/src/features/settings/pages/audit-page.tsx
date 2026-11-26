import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import type { TFunction } from "i18next"
import { FileDown, ScrollText } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { EmptyState, ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useStartJob } from "@/features/settings/api/activity"
import {
  AUDIT_KINDS,
  AUDIT_PAGE_SIZE,
  auditFilters,
  auditQuery,
  staffNamesQuery,
} from "@/features/settings/api/audit"
import type { AuditEntry, AuditSearch } from "@/features/settings/api/audit"
import { AuditDetailDialog } from "@/features/settings/components/audit-detail-dialog"
import { AuditFilters } from "@/features/settings/components/audit-filters"
import { JobsList } from "@/features/settings/components/jobs-list"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { staffQuery, useCan } from "@/features/auth/api/staff"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/settings/audit")
/** The jobs tab's key (`?part=jobs`): old /settings/jobs links land on it. */
const JOBS = "jobs"

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
      // What the others leave: a long path is cut short, the actor's column stays on the card
      fill: true,
      className: "min-w-32",
      cell: (entry) => (
        <div className="flex min-w-0 flex-col">
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

/** The export runs as a job with the log's filters; its file waits in the Jobs tab. */
function ExportButton({ search }: { search: AuditSearch }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const exportJob = useStartJob()
  const filtered = Object.keys(auditFilters(search)).length > 0
  const startExport = () => {
    exportJob.mutate(
      { type: "audit_log.export", input: auditFilters(search) },
      {
        onSuccess: () =>
          toast.success(t("settings.audit.exportStarted"), {
            action: {
              label: t("settings.audit.openJobs"),
              onClick: () => {
                void navigate({ to: "/settings/audit", search: { part: JOBS } })
              },
            },
          }),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <Button variant="outline" disabled={exportJob.isPending} onClick={startExport}>
      <FileDown />
      {t(filtered ? "settings.audit.exportFiltered" : "settings.audit.export")}
    </Button>
  )
}

/**
 * Settings > Audit log, in tabs (the owner, 2026-11-23): the log (adr/0040)
 * first, the long jobs (adr/0014) beside it, both for those who may read
 * the log. Any other role sees neither (the owner, 2026-11-23): one
 * sentence says so, as on the other screens a role may not open.
 */
export function AuditPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  // Until the role is known nothing is said about it
  const staff = useQuery(staffQuery())
  const audit = useCan("audit")
  if (!audit) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("settings.audit.title")} />
        {staff.isPending ? (
          <LoadingRows rows={6} />
        ) : (
          <EmptyState text={t("settings.audit.noAccess")} />
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.audit.title")}
        description={t("settings.audit.subtitle")}
        action={search.part === JOBS ? undefined : <ExportButton search={search} />}
      />
      <SettingsTabs
        label={t("settings.audit.title")}
        tabs={[
          { key: "log", label: t("settings.audit.tabs.log"), content: <AuditLog /> },
          { key: JOBS, label: t("settings.jobs.title"), content: <JobsList /> },
        ]}
      />
    </div>
  )
}

/**
 * The audit log (adr/0011, F12.5): who changed what and who read personal
 * data, newest first, by person, resource and day; an entry opens in full
 * in a dialog. Reading it is recorded too.
 */
function AuditLog() {
  const { t } = useTranslation()
  // The open tab is not a filter: going to the jobs and back keeps the page read
  const search: AuditSearch = { ...route.useSearch(), part: undefined }
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const log = useQuery(auditQuery(search, page))
  const walk = useRecordWalk(log.data?.audit_entries, (entry) => entry.id)
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

  return (
    <>
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <AuditFilters search={search} onChange={change}>
          {({ trigger, chips }) => (
            <>
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
                end={trigger}
              />
              {/* What is set, under the tabs: only while a filter is */}
              {chips ? <div className="border-b px-5 py-3">{chips}</div> : null}
            </>
          )}
        </AuditFilters>
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
              onRowClick={walk.show}
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
        <Link to="/settings/audit" search={{ part: JOBS }} className="underline">
          {t("settings.audit.openJobs")}
        </Link>
      </p>
      <AuditDetailDialog
        entry={walk.open}
        actor={walk.open ? actorOf(walk.open, staff.data, t) : ""}
        steps={walk.steps}
        onClose={walk.close}
      />
    </>
  )
}
