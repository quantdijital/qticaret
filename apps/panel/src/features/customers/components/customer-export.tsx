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
import { useCan } from "@/features/auth/api/staff"
import type { CustomerKind } from "@/features/customers/api/customers"
import { finishedJob } from "@/features/products/api/sheets"
import type { SheetJob } from "@/features/products/api/sheets"
import { jobResultUrl } from "@/features/settings/api/activity"
import { useJobsMessage } from "@/features/settings/use-jobs-message"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

const E = "customers.export"

/**
 * The customer list as it is filtered (its search and tab), as a file:
 * the list's own columns and numbers, no phone or address (KVKK). The
 * owner's alone; a job makes it on the server and records it, the panel
 * waits for it and downloads it, and Settings > Jobs keeps it a week.
 */
export function CustomerExportButton({ q, kind }: { q: string; kind: CustomerKind }) {
  const { t } = useTranslation()
  const jobs = useJobsMessage()
  const allowed = useCan("customerExport")
  const [running, setRunning] = useState(false)
  if (!allowed) {
    return null
  }
  const start = async (format: "xlsx" | "csv") => {
    setRunning(true)
    try {
      const { async_job: started } = await sdk.client.fetch<{ async_job: SheetJob }>(
        "/admin/customer-export",
        { method: "POST", body: { ...(q ? { q } : {}), kind, format } }
      )
      const job = await finishedJob(started.id)
      if (job.status === "succeeded") {
        window.location.assign(new URL(await jobResultUrl(job.id), window.location.origin).href)
      } else if (job.status === "queued" || job.status === "running") {
        toast.info(t(jobs(`${E}.later`)))
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* As tall as the columns button beside it; its word hides on a phone, as that one's */}
        <Button variant="outline" disabled={running} aria-label={t(`${E}.button`)}>
          {running ? <Loader2 className="animate-spin" /> : <Download />}
          <span className="max-sm:sr-only">{t(`${E}.button`)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            void start("xlsx")
          }}
        >
          {t(`${E}.excel`)}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void start("csv")
          }}
        >
          {t(`${E}.csv`)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
