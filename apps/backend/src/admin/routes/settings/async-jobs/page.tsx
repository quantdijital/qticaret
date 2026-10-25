import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "../../../components/page-states"
import { errorText } from "../../../lib/errors"
import { sdk } from "../../../lib/sdk"

interface AsyncJob {
  id: string
  type: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  progress: number
  error_code: string | null
  has_result: boolean
  result_summary: { rows?: number; truncated?: boolean } | null
  created_at: string
  finished_at: string | null
}

const KEY = ["qticaret", "async-jobs"]
const STATUS_COLOR = {
  queued: "grey",
  running: "blue",
  succeeded: "green",
  failed: "red",
  cancelled: "grey",
} as const

const isActive = (job: AsyncJob) => job.status === "queued" || job.status === "running"

/**
 * Settings > Jobs (F2.8, adr/0014): long tasks with their progress and
 * results. Refreshes every few seconds while a job is queued or running.
 */
function AsyncJobsPage() {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: () => sdk.client.fetch<{ async_jobs: AsyncJob[] }>("/admin/async-jobs"),
    refetchInterval: (query) => (query.state.data?.async_jobs.some(isActive) ? 3_000 : false),
  })
  const exportLog = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/async-jobs", {
        method: "POST",
        body: { type: "audit_log.export", input: {} },
      }),
    onSuccess: async () => {
      toast.success(t("qticaret.asyncJobs.queued"))
      await client.invalidateQueries({ queryKey: KEY })
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  const download = useMutation({
    mutationFn: (job: AsyncJob) =>
      sdk.client.fetch<{ url: string }>(`/admin/async-jobs/${encodeURIComponent(job.id)}/result`),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer")
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  const time = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : "—"

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h1">{t("qticaret.asyncJobs.title")}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {t("qticaret.asyncJobs.subtitle")}
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          isLoading={exportLog.isPending}
          onClick={() => {
            exportLog.mutate()
          }}
        >
          {t("qticaret.asyncJobs.exportAuditLog")}
        </Button>
      </div>
      <div className="px-6 py-4">
        {isPending ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState text={errorText(t, error)} onRetry={() => void refetch()} />
        ) : data.async_jobs.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            {t("qticaret.asyncJobs.empty")}
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("qticaret.asyncJobs.type")}</Table.HeaderCell>
                <Table.HeaderCell>{t("qticaret.asyncJobs.status")}</Table.HeaderCell>
                <Table.HeaderCell>{t("qticaret.asyncJobs.requested")}</Table.HeaderCell>
                <Table.HeaderCell>{t("qticaret.asyncJobs.finished")}</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.async_jobs.map((job) => (
                <Table.Row key={job.id}>
                  <Table.Cell>
                    {t(`qticaret.asyncJobs.types.${job.type.replace(/\./g, "_")}`, {
                      defaultValue: job.type,
                    })}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-1">
                      <Badge size="2xsmall" color={STATUS_COLOR[job.status]} className="w-fit">
                        {t(`qticaret.asyncJobs.statuses.${job.status}`)}
                        {job.status === "running" ? ` %${String(job.progress)}` : ""}
                      </Badge>
                      {job.status === "failed" && job.error_code && (
                        <Text size="xsmall" className="text-ui-fg-error">
                          {t(`qticaret.asyncJobs.errors.${job.error_code.replace(/\./g, "_")}`, {
                            defaultValue: t("qticaret.asyncJobs.errors.failed"),
                          })}
                        </Text>
                      )}
                      {job.result_summary?.truncated && (
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {t("qticaret.asyncJobs.truncated", {
                            rows: job.result_summary.rows ?? 0,
                          })}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{time(job.created_at)}</Table.Cell>
                  <Table.Cell>{time(job.finished_at)}</Table.Cell>
                  <Table.Cell className="text-right">
                    {job.has_result && (
                      <Button
                        size="small"
                        variant="transparent"
                        isLoading={download.isPending}
                        onClick={() => {
                          download.mutate(job)
                        }}
                      >
                        {t("qticaret.asyncJobs.download")}
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "qticaret.asyncJobs.title",
})

export default AsyncJobsPage
