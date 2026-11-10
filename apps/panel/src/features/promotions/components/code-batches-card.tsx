import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Ban, Download, Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { EmptyState, ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { sheetJobQuery } from "@/features/products/api/sheets"
import {
  MAX_CODES,
  batchCodesUrl,
  codeBatchesQuery,
  codeCountOf,
  revokeCodeBatch,
  startCodeBatch,
} from "@/features/promotions/api/code-batches"
import type { CodeBatch } from "@/features/promotions/api/code-batches"
import { errorText } from "@/lib/errors"
import { formatCount, formatDateTime } from "@qticaret/admin-ui/lib/format"

/** How many codes, then the job's progress until they are written. */
function MakeCodesDialog({
  promotionId,
  code,
  open,
  onOpenChange,
}: {
  promotionId: string
  code: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [text, setText] = useState("100")
  const [error, setError] = useState<string | undefined>()
  const [starting, setStarting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const job = useQuery(sheetJobQuery(jobId))
  const status = job.data?.status
  const running = starting || status === "queued" || status === "running"
  const created = status === "succeeded" ? Number(job.data?.result_summary?.["created"] ?? 0) : null

  // Closed once the batch is written or failed; the card then reads its batches again
  const close = () => {
    onOpenChange(false)
    setJobId(null)
    setError(undefined)
    void client.invalidateQueries({ queryKey: ["promotions"] })
  }

  const start = async () => {
    const count = codeCountOf(text)
    if (count === null) {
      setError(t("promotions.codes.countError", { max: formatCount(MAX_CODES) }))
      return
    }
    setStarting(true)
    try {
      setJobId((await startCodeBatch(promotionId, count)).id)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setStarting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A batch being written finishes on its own; the dialog stays until it does
        if (!next && !running) {
          close()
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("promotions.codes.makeTitle")}</DialogTitle>
          <DialogDescription>{t("promotions.codes.makeHint", { code })}</DialogDescription>
        </DialogHeader>
        <Field
          label={t("promotions.codes.count")}
          htmlFor="code-count"
          hint={t("promotions.codes.countHint", { max: formatCount(MAX_CODES) })}
          error={error}
        >
          <NumberField
            min={1}
            max={MAX_CODES}
            id="code-count"
            className="w-40"
            value={text}
            disabled={running || created !== null}
            onChange={(event) => {
              setText(event.target.value)
              setError(undefined)
            }}
          />
        </Field>
        {status === "failed" ? (
          <p role="alert" className="text-sm text-destructive">
            {job.data?.error_message ?? t("promotions.codes.failed")}
          </p>
        ) : null}
        {created !== null ? (
          <p role="status" className="text-sm">
            {t("promotions.codes.done", { count: created, formatted: formatCount(created) })}
          </p>
        ) : null}
        {running && jobId ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("promotions.codes.running", { percent: job.data?.progress ?? 0 })}
          </p>
        ) : null}
        <DialogFooter>
          {created !== null ? (
            <Button onClick={close}>{t("common.close")}</Button>
          ) : (
            <>
              <Button variant="outline" disabled={running} onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button disabled={running} onClick={() => void start()}>
                {running ? <Loader2 className="animate-spin" /> : null}
                {t("promotions.codes.make")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Ended on its campaign's day, or stopped
const hasEnded = (batch: CodeBatch) =>
  batch.ends_at !== null && new Date(batch.ends_at).getTime() <= Date.now()

/** One batch: its size and use, its codes to download, and a way to stop them. */
function BatchRow({ promotionId, batch }: { promotionId: string; batch: CodeBatch }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [asking, setAsking] = useState(false)
  const closed = hasEnded(batch)
  const stop = useMutation({
    mutationFn: () => revokeCodeBatch(promotionId, batch.campaign_id),
    onSuccess: async () => {
      toast.success(t("promotions.codes.stopped"))
      await client.invalidateQueries({ queryKey: ["promotions", "code-batches", promotionId] })
    },
    onError: (failure) => toast.error(errorText(t, failure)),
  })
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium tabular-nums">
          {t("promotions.codes.batch", { count: batch.count, formatted: formatCount(batch.count) })}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("promotions.codes.batchMeta", {
            date: formatDateTime(batch.created_at),
            used: formatCount(batch.used),
          })}
        </span>
      </div>
      {closed ? <StatusBadge tone="neutral">{t("promotions.codes.closed")}</StatusBadge> : null}
      <Button asChild size="sm" variant="ghost">
        <a href={batchCodesUrl(promotionId, batch.campaign_id)} download>
          <Download />
          {t("promotions.codes.download")}
        </a>
      </Button>
      {closed ? null : (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive-text"
          disabled={stop.isPending}
          onClick={() => {
            setAsking(true)
          }}
        >
          <Ban />
          {t("promotions.codes.stop")}
        </Button>
      )}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("promotions.codes.stopTitle")}
        description={t("promotions.codes.stopHint", { formatted: formatCount(batch.count) })}
        confirmLabel={t("promotions.codes.stopConfirm")}
        destructive
        onConfirm={() => {
          setAsking(false)
          stop.mutate()
        }}
      />
    </li>
  )
}

/**
 * Single-use codes from this promotion (F4.6, ADR-0024): its batches, how
 * many of each were used, their codes to download, and a way to make more.
 */
export function CodeBatchesCard({ promotionId, code }: { promotionId: string; code: string }) {
  const { t } = useTranslation()
  const batches = useQuery(codeBatchesQuery(promotionId))
  const [open, setOpen] = useState(false)
  const make = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        setOpen(true)
      }}
    >
      <Plus />
      {t("promotions.codes.make")}
    </Button>
  )
  return (
    <SectionCard
      title={t("promotions.codes.title")}
      description={t("promotions.codes.hint")}
      action={batches.data && batches.data.length > 0 ? make : null}
    >
      {batches.isError && !batches.data ? (
        <ErrorState text={errorText(t, batches.error)} onRetry={() => void batches.refetch()} />
      ) : !batches.data ? (
        <LoadingRows rows={2} />
      ) : batches.data.length === 0 ? (
        <EmptyState text={t("promotions.codes.empty")} action={make} />
      ) : (
        <ul className="flex flex-col divide-y">
          {batches.data.map((batch) => (
            <BatchRow key={batch.campaign_id} promotionId={promotionId} batch={batch} />
          ))}
        </ul>
      )}
      <MakeCodesDialog promotionId={promotionId} code={code} open={open} onOpenChange={setOpen} />
    </SectionCard>
  )
}
