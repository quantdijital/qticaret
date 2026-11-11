import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { runQuery } from "@/features/provisioning/api"
import type { Run } from "@/features/provisioning/api"
import { codeText, durationText, kindName, runLine } from "@/features/provisioning/words"
import { errorText } from "@/lib/errors"
import { RunBody, RunStatusBadge } from "./run-card"

/** One run of the history in full: its steps read when it opens. */
function RunDialog({
  tenantId,
  walk,
}: {
  tenantId: string
  walk: ReturnType<typeof useRecordWalk<Run>>
}) {
  const { t } = useTranslation()
  const run = walk.open
  const full = useQuery({ ...runQuery(tenantId, run?.id ?? ""), enabled: run !== null })
  return (
    <DetailDialog
      open={run !== null}
      onOpenChange={(open) => {
        if (!open) {
          walk.close()
        }
      }}
      size="lg"
      pane
      title={run ? kindName(t, run.kind) : ""}
      description={run ? runLine(t, run) : undefined}
      headerAction={
        <RecordStepper
          {...walk.steps}
          previousLabel={t("setup.previous")}
          nextLabel={t("setup.next")}
        />
      }
    >
      <DialogBody>
        {full.data ? (
          <RunBody run={full.data.run} inset={false} />
        ) : full.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorText(t, full.error)}
          </p>
        ) : (
          <LoadingRows rows={4} />
        )}
      </DialogBody>
    </DetailDialog>
  )
}

/** Every run of the shop's setup, newest first; a row opens it with its steps. */
export function HistoryCard({ tenantId, runs }: { tenantId: string; runs: Run[] }) {
  const { t } = useTranslation()
  const walk = useRecordWalk(runs, (run) => run.id)
  const columns: Column<Run>[] = [
    {
      key: "kind",
      header: t("setup.columns.kind"),
      cell: (run) => (
        <button
          type="button"
          className="text-left font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            walk.show(run)
          }}
        >
          {kindName(t, run.kind)}
        </button>
      ),
    },
    {
      key: "status",
      header: t("setup.columns.status"),
      cell: (run) => <RunStatusBadge status={run.status} />,
    },
    {
      key: "started",
      header: t("setup.columns.started"),
      className: "hidden md:table-cell",
      cell: (run) => formatDateTime(run.started_at),
    },
    {
      key: "duration",
      header: t("setup.columns.duration"),
      className: "hidden md:table-cell",
      cell: (run) => durationText(t, run.started_at, run.finished_at) ?? "—",
    },
    {
      key: "problem",
      header: t("setup.columns.problem"),
      className: "hidden lg:table-cell",
      cell: (run) => codeText(t, run.error_code) ?? "—",
    },
  ]
  return (
    <SectionCard title={t("setup.historyTitle")} description={t("setup.historyText")} flush>
      <DataTable
        columns={columns}
        rows={runs}
        rowKey={(run) => run.id}
        onRowClick={walk.show}
        empty={t("setup.historyEmpty")}
      />
      <RunDialog tenantId={tenantId} walk={walk} />
    </SectionCard>
  )
}
