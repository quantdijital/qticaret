import type { TFunction } from "i18next"
import { toast } from "sonner"
import type { BulkSummary } from "@/features/products/api/bulk"
import { finishedJob } from "@/features/products/api/sheets"
import { jobResultUrl } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const count = (value: number) => ({ count: value, formatted: formatCount(value) })

// The report's link lives a few minutes: asked for on the click, only a web link followed
async function openReport(t: TFunction, jobId: string) {
  try {
    const url = new URL(await jobResultUrl(jobId), window.location.origin)
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("unexpected link")
    }
    window.location.assign(url.href)
  } catch (failure) {
    toast.error(errorText(t, failure))
  }
}

/**
 * A bulk job started where nothing stays open to show it (an add-on saved
 * as a template and applied, 2026-11-23): one toast that says it is
 * working, then what it did — linked, already linked, left out — with
 * the report as the bulk edit dialog gives it. `settled` runs once it
 * has finished, so the page reads its products again.
 */
export async function toastBulkJob(
  t: TFunction,
  jobId: string,
  settled?: () => void
): Promise<void> {
  const id = `bulk-job-${jobId}`
  toast.loading(t("products.bulk.working"), { id })
  try {
    const job = await finishedJob(jobId)
    settled?.()
    if (job.status === "queued" || job.status === "running") {
      toast.info(t("products.bulk.background"), { id })
      return
    }
    if (job.status !== "succeeded" || !job.result_summary) {
      toast.error(job.error_message ?? t("products.bulk.jobFailed"), { id })
      return
    }
    const summary = job.result_summary as unknown as BulkSummary
    const left = summary.skipped + summary.failed
    const notes = [
      summary.unchanged > 0 ? t("products.bulk.unchanged", count(summary.unchanged)) : null,
      left > 0 ? t("products.bulk.left", count(left)) : null,
    ].filter((note): note is string => note !== null)
    const show = left > 0 ? toast.warning : toast.success
    show(t("products.bulk.changed", count(summary.changed)), {
      id,
      duration: left > 0 ? 15_000 : 6_000,
      ...(notes.length > 0 ? { description: notes.join(" ") } : {}),
      ...(job.has_result
        ? { action: { label: t("products.bulk.report"), onClick: () => void openReport(t, jobId) } }
        : {}),
    })
  } catch (failure) {
    toast.error(errorText(t, failure), { id })
  }
}
