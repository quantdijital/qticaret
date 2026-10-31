import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useCancelJob } from "@/features/settings/api/activity"
import type { AsyncJob } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"

const J = "settings.jobs"

/** A queued or running job stopped, asked first: what it did by then stays. */
export function JobCancelButton({ job }: { job: AsyncJob }) {
  const { t } = useTranslation()
  const cancel = useCancelJob()
  const [asking, setAsking] = useState(false)
  if (job.status !== "queued" && job.status !== "running") {
    return null
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={cancel.isPending}
        onClick={() => {
          setAsking(true)
        }}
      >
        {t(`${J}.cancel`)}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${J}.cancelTitle`)}
        description={t(`${J}.cancelHint`)}
        confirmLabel={t(`${J}.cancel`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          cancel.mutate(job.id, {
            onSuccess: () => toast.success(t(`${J}.cancelled`)),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}
