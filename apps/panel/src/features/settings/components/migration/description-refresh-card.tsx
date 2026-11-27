import { useQuery } from "@tanstack/react-query"
import { Check, FileText, Minus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { migrationJobQuery, useStartMigration } from "@/features/settings/api/migration"
import { WXR_ACCEPT } from "@/features/settings/api/migration-wordpress"
import { RunResult } from "@/features/settings/components/migration/run-result"
import { fileProblem } from "@/features/settings/components/migration/wxr-file"
import { errorText } from "@/lib/errors"

const D = "settings.migration.refresh"

/**
 * "Ürün açıklamalarını yeniden al" (ADR-0055), apart from the run: the
 * descriptions of products an earlier WordPress run moved are written
 * again from the export, over what was edited in the panel since. Its
 * dialog says what changes and what does not, takes the export (each run
 * deletes its file, so it is asked again) and starts it; the card follows
 * the job to its outcome.
 */
export function DescriptionRefreshCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const start = useStartMigration()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [shown, setShown] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const job = useQuery(migrationJobQuery(jobId))
  const running = job.data?.status === "queued" || job.data?.status === "running"
  const problem = fileProblem(file)
  const close = () => {
    setOpen(false)
    setFile(null)
    setShown(false)
  }
  return (
    <SectionCard
      title={t(`${D}.title`)}
      description={t(`${D}.description`)}
      action={
        <Button
          variant="outline"
          disabled={running || start.isPending}
          onClick={() => {
            setOpen(true)
          }}
        >
          <FileText />
          {t(`${D}.start`)}
        </Button>
      }
      {...(className ? { className } : {})}
    >
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-[13px] text-muted-foreground">{t(`${D}.wordpressOnly`)}</p>
        {job.data ? <RunResult job={job.data} source="wordpress" /> : null}
      </div>
      <FormDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            close()
          }
        }}
        title={t(`${D}.title`)}
        description={t(`${D}.dialogText`)}
        dirty={file !== null}
        canSubmit={problem === null}
        saving={start.isPending}
        submitLabel={t(`${D}.confirm`)}
        onSubmit={() => {
          setShown(true)
          if (!file || problem) {
            return
          }
          start.mutate(
            {
              kind: "wordpress",
              mode: "apply",
              parcel: null,
              file,
              categoryBase: "",
              refresh: "descriptions",
            },
            {
              onSuccess: (started) => {
                setJobId(started.id)
                close()
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      >
        <DialogBody>
          <ul className="flex flex-col gap-2 rounded-md border px-3 py-2.5 text-[13px]">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden="true" />
              <span>
                <span className="font-medium">{t(`${D}.changes`)}</span> {t(`${D}.changesText`)}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="font-medium">{t(`${D}.keeps`)}</span> {t(`${D}.keepsText`)}
              </span>
            </li>
          </ul>
          <Field
            label={t("settings.migration.wordpress.file")}
            htmlFor="refresh-file"
            hint={t(`${D}.fileHint`)}
            error={shown && problem ? t(problem) : undefined}
          >
            <Input
              id="refresh-file"
              type="file"
              accept={WXR_ACCEPT}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setShown(true)
              }}
            />
          </Field>
        </DialogBody>
      </FormDialog>
    </SectionCard>
  )
}
