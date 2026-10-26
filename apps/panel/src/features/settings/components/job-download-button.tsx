import { Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { jobResultUrl } from "@/features/settings/api/activity"
import type { AsyncJob } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"

/** Downloads a finished job's file (adr/0014); nothing while it has none. */
export function JobDownloadButton({ job, label }: { job: AsyncJob; label?: string }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  if (!job.has_result) {
    return null
  }
  const open = async () => {
    setBusy(true)
    try {
      // The link lives a few minutes: fetched on demand, never kept; only web links are followed
      const url = new URL(await jobResultUrl(job.id), window.location.origin)
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("unexpected link")
      }
      window.location.assign(url.href)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => void open()}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {label ?? t("settings.jobs.download")}
    </Button>
  )
}
