import { Check, Minus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { WXR_ACCEPT } from "@/features/settings/api/migration-wordpress"
import type {
  CompletionInput,
  CompletionKey,
} from "@/features/settings/components/migration/completion-rows"
import { fileProblem } from "@/features/settings/components/migration/wxr-file"

const C = "settings.migration.completions"

export interface CompletionValues {
  file: File | null
  url: string
}

interface CompletionDialogProps {
  /** The row whose dialog is open; null: closed. */
  row: CompletionKey | null
  input: CompletionInput
  /** A file the page holds already (the wizard's): asked again only when none. */
  presetFile?: File | null
  saving: boolean
  onClose: () => void
  onSubmit: (values: CompletionValues) => void
}

/**
 * Every completion's one dialog (adr/0042 Ek 2026-11-27): what changes,
 * what stays the same, and what it needs: the WordPress export again (each
 * job deletes its file) or the feed's address. The button says what happens.
 */
export function CompletionDialog({
  row,
  input,
  presetFile = null,
  saving,
  onClose,
  onSubmit,
}: CompletionDialogProps) {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [shown, setShown] = useState(false)
  const chosen = file ?? presetFile
  const asksFile = input === "file" && presetFile === null
  const problem =
    input === "file"
      ? chosen
        ? fileProblem(chosen)
        : "settings.migration.wordpress.errors.fileRequired"
      : null
  const urlProblem = input === "url" && !/^https?:\/\/\S+$/i.test(url.trim())
  const guard = useDiscardGuard(file !== null || url !== "")
  const reset = () => {
    setFile(null)
    setUrl("")
    setShown(false)
  }
  const key = row ?? "images"
  return (
    <FormDialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          onClose()
        }
      }}
      title={t(`${C}.rows.${key}.title`)}
      description={t(`${C}.rows.${key}.text`)}
      dirty
      guard={guard}
      canSubmit={problem === null && !urlProblem}
      saving={saving}
      submitLabel={t(`${C}.rows.${key}.submit`)}
      onSubmit={() => {
        setShown(true)
        if (problem === null && !urlProblem) {
          onSubmit({ file: chosen, url: url.trim() })
          reset()
        }
      }}
    >
      <DialogBody>
        <ul className="flex flex-col gap-2 rounded-md border px-3 py-2.5 text-[13px]">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden="true" />
            <span>
              <span className="font-medium">{t(`${C}.changes`)}</span>{" "}
              {t(`${C}.rows.${key}.changes`)}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              <span className="font-medium">{t(`${C}.keeps`)}</span> {t(`${C}.rows.${key}.keeps`)}
            </span>
          </li>
        </ul>
        {asksFile ? (
          <Field
            label={t(`${C}.file`)}
            htmlFor="completion-file"
            hint={t(`${C}.fileHint`)}
            error={shown && file && problem ? t(problem) : undefined}
          >
            <Input
              id="completion-file"
              type="file"
              accept={WXR_ACCEPT}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setShown(true)
              }}
            />
          </Field>
        ) : null}
        {input === "url" ? (
          <Field label={t(`${C}.feedUrl`)} htmlFor="completion-url" hint={t(`${C}.feedUrlHint`)}>
            <Input
              id="completion-url"
              type="url"
              inputMode="url"
              placeholder="https://eski-magaza.com/xml/google.xml"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
              }}
            />
          </Field>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
