import { Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { finishedJob } from "@/features/products/api/sheets"
import type { SheetJob } from "@/features/products/api/sheets"
import { useReportRange } from "@/features/reports/use-report"
import { jobResultUrl } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

export type ReportTable =
  | "summary"
  | "daily"
  | "products"
  | "categories"
  | "brands"
  | "promotions"
  | "sources"
  | "returns"
  | "vat"
  | "payments"
  | "chargebacks"

const E = "reports.export"

/**
 * A report as a file (F11.1, adr/0039): made on the server from the same
 * numbers as the screen, its text escaped against formulas; an xlsx with
 * every table, or one table as CSV. It runs as a job the panel waits for;
 * Settings > Jobs keeps the file for a week too.
 */
export function ReportExportButton({
  report = "sales",
  format,
  table,
  size,
}: {
  report?: "sales" | "finance"
  format: "xlsx" | "csv"
  /** The CSV's table; an xlsx has every table of the report. */
  table?: ReportTable
  size?: "sm" | "default"
}) {
  const { t } = useTranslation()
  const range = useReportRange()
  const [running, setRunning] = useState(false)
  const start = async () => {
    setRunning(true)
    try {
      const { async_job: started } = await sdk.client.fetch<{ async_job: SheetJob }>(
        "/admin/async-jobs",
        {
          method: "POST",
          body: {
            type: "report.export",
            input: { ...range, report, format, ...(table ? { table } : {}) },
          },
        }
      )
      const job = await finishedJob(started.id)
      if (job.status === "succeeded") {
        window.location.assign(new URL(await jobResultUrl(job.id), window.location.origin).href)
      } else if (job.status === "queued" || job.status === "running") {
        toast.info(t(`${E}.later`))
      } else {
        toast.error(job.error_message ?? t(`${E}.failed`))
      }
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setRunning(false)
    }
  }
  return (
    <Button
      variant="outline"
      size={size ?? "default"}
      disabled={running}
      onClick={() => {
        void start()
      }}
    >
      {running ? <Loader2 className="animate-spin" /> : <Download />}
      {t(format === "xlsx" ? `${E}.excel` : `${E}.csv`)}
    </Button>
  )
}
