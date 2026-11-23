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
import { startBulkEdit } from "@/features/products/api/bulk"
import type { BulkAction } from "@/features/products/api/bulk"
import { sheetJobQuery } from "@/features/products/api/sheets"
import { BulkFields } from "@/features/products/bulk/bulk-fields"
import { EMPTY_BULK_FORM, bulkChangeOf } from "@/features/products/bulk/bulk-form"
import type { BulkForm } from "@/features/products/bulk/bulk-form"
import { BulkJobResult } from "@/features/products/bulk/bulk-job-result"
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

/**
 * One change to the products picked (F3.10): its fields, then the job's
 * progress and what it did, with its report. The server checks each
 * product as its own save would (gates, measurements, the ledger).
 */
export function BulkEditDialog({ action, productIds, onClose, onDone }: BulkEditDialogProps) {
  const { t } = useTranslation()
  const jobs = useJobsMessage()
  const client = useQueryClient()
  const [form, setForm] = useState<BulkForm>(EMPTY_BULK_FORM)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
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
    setJobId(null)
    onClose()
  }
  const apply = async () => {
    setTried(true)
    if (!result || !("change" in result)) {
      return
    }
    setSending(true)
    try {
      setJobId((await startBulkEdit(productIds, result.change)).id)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setSending(false)
    }
  }
  const count = { count: productIds.length, formatted: formatCount(productIds.length) }
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
          <DialogDescription>{t("products.bulk.scope", count)}</DialogDescription>
        </DialogHeader>
        {action ? (
          <div className="flex flex-col gap-4">
            {job ? (
              <BulkJobResult job={job} />
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
          ) : (
            <>
              <Button variant="cancel" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button disabled={sending} onClick={() => void apply()}>
                {sending ? <Loader2 className="animate-spin" /> : null}
                {t("products.bulk.apply", count)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
