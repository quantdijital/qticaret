import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { previewBulkEdit, startBulkEdit } from "@/features/products/api/bulk"
import type { BulkAction, BulkChange, BulkPreview } from "@/features/products/api/bulk"
import { sheetJobQuery } from "@/features/products/api/sheets"
import { BulkFields } from "@/features/products/bulk/bulk-fields"
import { EMPTY_BULK_FORM, bulkChangeOf } from "@/features/products/bulk/bulk-form"
import type { BulkForm } from "@/features/products/bulk/bulk-form"
import { BulkJobResult, BulkPreviewResult } from "@/features/products/bulk/bulk-job-result"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { useJobsMessage } from "@/features/settings/use-jobs-message"

interface BulkEditDialogProps {
  /** The change to make; null while the dialog is closed. */
  action: BulkAction | null
  productIds: string[]
  onClose: () => void
  /** A job was started: the products read again, the picks let go. */
  onDone: () => void
}

const count = (value: number) => ({ count: value, formatted: formatCount(value) })

/**
 * One change to the products picked (F3.10): its fields, then what it
 * would do (how many change, are so already, are left out and why), then
 * the job's progress and what it did, with its report. The server checks
 * each product as its own save would (gates, measurements, the ledger).
 */
export function BulkEditDialog({ action, productIds, onClose, onDone }: BulkEditDialogProps) {
  const { t } = useTranslation()
  const jobs = useJobsMessage()
  const client = useQueryClient()
  const [form, setForm] = useState<BulkForm>(EMPTY_BULK_FORM)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  // The change previewed, as it will be sent: the fields stay as they are behind it
  const [preview, setPreview] = useState<{ change: BulkChange; result: BulkPreview } | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const job = useQuery(sheetJobQuery(jobId)).data
  const finished = job !== undefined && job.status !== "queued" && job.status !== "running"
  const result = action ? bulkChangeOf(action, form) : null
  const error = tried && result && "error" in result ? result.error : null

  const close = () => {
    if (job && !finished) {
      // The job goes on on the server; Settings > Audit log > Jobs shows where it stands
      toast.info(t(jobs("products.bulk.background")))
    }
    if (job) {
      void client.invalidateQueries({ queryKey: ["products"] })
      void client.invalidateQueries({ queryKey: ["seo"] })
      onDone()
    }
    setForm(EMPTY_BULK_FORM)
    setTried(false)
    setPreview(null)
    setJobId(null)
    onClose()
  }
  const send = async (work: () => Promise<void>) => {
    setSending(true)
    try {
      await work()
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setSending(false)
    }
  }
  const look = () => {
    setTried(true)
    if (!result || !("change" in result)) {
      return
    }
    const { change } = result
    void send(async () => {
      setPreview({ change, result: await previewBulkEdit(productIds, change) })
    })
  }
  const apply = () => {
    if (!preview) {
      return
    }
    void send(async () => {
      setJobId((await startBulkEdit(productIds, preview.change)).id)
    })
  }
  return (
    <Dialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action ? t(`products.bulk.actions.${action}`) : null}</DialogTitle>
          <DialogDescription>
            {t("products.bulk.scope", count(productIds.length))}
          </DialogDescription>
        </DialogHeader>
        {action ? (
          <div className="flex flex-col gap-4">
            {job ? (
              <BulkJobResult job={job} />
            ) : preview ? (
              <BulkPreviewResult preview={preview.result} />
            ) : (
              <BulkFields
                action={action}
                form={form}
                error={error}
                onChange={(patch) => {
                  setForm((current) => ({ ...current, ...patch }))
                }}
              />
            )}
          </div>
        ) : null}
        <DialogFooter>
          {job ? (
            <Button variant="outline" onClick={close}>
              {t("common.close")}
            </Button>
          ) : preview ? (
            <>
              <Button
                variant="cancel"
                onClick={() => {
                  setPreview(null)
                }}
              >
                {t("common.back")}
              </Button>
              <Button disabled={sending || preview.result.changed === 0} onClick={apply}>
                {sending ? <Loader2 className="animate-spin" /> : null}
                {t("products.bulk.apply", count(preview.result.changed))}
              </Button>
            </>
          ) : (
            <>
              <Button variant="cancel" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button disabled={sending} onClick={look}>
                {sending ? <Loader2 className="animate-spin" /> : null}
                {t("products.bulk.preview")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
