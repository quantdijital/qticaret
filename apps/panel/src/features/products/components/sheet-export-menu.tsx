import { Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { finishedJob, startExport } from "@/features/products/api/sheets"
import { jobResultUrl } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"

/**
 * The catalog as a sheet (F3.9): the export runs as a job; the menu waits
 * for it and offers the file, which Settings > Jobs keeps for a week too.
 */
export function SheetExportMenu() {
  const { t } = useTranslation()
  const [running, setRunning] = useState(false)
  const download = (id: string) => {
    jobResultUrl(id)
      .then((url) => {
        window.location.assign(new URL(url, window.location.origin).href)
      })
      .catch((failure: unknown) => toast.error(errorText(t, failure)))
  }
  const start = async (format: "xlsx" | "csv") => {
    setRunning(true)
    try {
      const started = await startExport(format)
      toast.info(t("products.sheets.exportStarted"))
      const job = await finishedJob(started.id)
      if (job.status === "succeeded") {
        toast.success(t("products.sheets.exportReady"), {
          action: {
            label: t("products.sheets.download"),
            onClick: () => {
              download(job.id)
            },
          },
        })
      } else if (job.status !== "queued" && job.status !== "running") {
        toast.error(job.error_message ?? t("products.sheets.exportFailed"))
      }
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setRunning(false)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <Download />}
          {t("products.sheets.export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            void start("xlsx")
          }}
        >
          {t("products.sheets.exportExcel")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void start("csv")
          }}
        >
          {t("products.sheets.exportCsv")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
