import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { AUDIT_PAGE_SIZE, auditQuery } from "@/features/audit/api"
import type { AuditEntry } from "@/features/audit/api"
import { errorText } from "@/lib/errors"

function Outcome({ status }: { status: number | null }) {
  const { t } = useTranslation()
  if (status === null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <StatusBadge tone={status < 400 ? "success" : "danger"}>
      {t(status < 400 ? "audit.done" : "audit.refused", { status })}
    </StatusBadge>
  )
}

const actorOf = (entry: AuditEntry) => entry.actor_id ?? entry.actor_type ?? "—"

/** The rows of one entry in full: what it holds, field by field; a change's names only. */
function EntryFacts({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation()
  const rows: [string, string][] = [
    [t("audit.columns.at"), formatDateTime(entry.created_at)],
    [t("audit.columns.kind"), t(`audit.kinds.${entry.kind}`)],
    [t("audit.columns.actor"), actorOf(entry)],
    [
      t("audit.columns.resource"),
      [entry.resource_type, entry.resource_id].filter(Boolean).join(" · ") || "—",
    ],
    [t("audit.request"), entry.request_id ?? "—"],
    [t("audit.place"), entry.ip_hash ?? "—"],
  ]
  return (
    <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-[13px] text-muted-foreground">{label}</dt>
          <dd className="min-w-0 font-mono text-[13px] break-all">{value}</dd>
        </div>
      ))}
      <dt className="text-[13px] text-muted-foreground">{t("audit.changes")}</dt>
      <dd className="min-w-0">
        {entry.changes ? (
          <pre className="rounded-md bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap break-all">
            {JSON.stringify(entry.changes, null, 2)}
          </pre>
        ) : (
          "—"
        )}
      </dd>
    </dl>
  )
}

/**
 * The control plane's audit log (owner, adr/0061 §3.5): every change,
 * refusals included, every sensitive read and the system's own actions,
 * newest first. Append-only: nothing here edits. A row opens the entry.
 */
export function AuditPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const audit = useQuery(auditQuery(page))
  const walk = useRecordWalk(audit.data?.entries, (entry) => entry.id)
  const columns: Column<AuditEntry>[] = [
    { key: "at", header: t("audit.columns.at"), cell: (entry) => formatDateTime(entry.created_at) },
    {
      key: "action",
      header: t("audit.columns.action"),
      // The row opens the entry; the keyboard reaches it through this button
      cell: (entry) => (
        <button
          type="button"
          className="text-left font-mono text-[13px] break-all hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            walk.show(entry)
          }}
        >
          {entry.action}
        </button>
      ),
    },
    {
      key: "actor",
      header: t("audit.columns.actor"),
      className: "hidden lg:table-cell",
      cell: (entry) => <span className="font-mono text-[13px]">{actorOf(entry)}</span>,
    },
    {
      key: "outcome",
      header: t("audit.columns.outcome"),
      cell: (entry) => <Outcome status={entry.outcome} />,
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("audit.title")} description={t("audit.text")} />
      {audit.isError ? (
        <ErrorState text={errorText(t, audit.error)} onRetry={() => void audit.refetch()} />
      ) : (
        <SectionCard title={t("audit.entries")} flush>
          <DataTable
            columns={columns}
            rows={audit.data?.entries}
            rowKey={(entry) => entry.id}
            onRowClick={walk.show}
            loading={audit.isPending}
            stale={audit.isPlaceholderData}
            empty={t("audit.empty")}
          />
          <Pagination
            page={page}
            pageSize={AUDIT_PAGE_SIZE}
            count={audit.data?.count ?? 0}
            onPageChange={setPage}
          />
        </SectionCard>
      )}
      <DetailDialog
        open={walk.open !== null}
        onOpenChange={(open) => {
          if (!open) {
            walk.close()
          }
        }}
        size="lg"
        title={walk.open?.action ?? ""}
        descriptionClassName="font-mono text-xs"
        headerAction={
          <RecordStepper
            {...walk.steps}
            previousLabel={t("audit.previous")}
            nextLabel={t("audit.next")}
          />
        }
      >
        <DialogBody>{walk.open ? <EntryFacts entry={walk.open} /> : null}</DialogBody>
      </DetailDialog>
    </div>
  )
}
