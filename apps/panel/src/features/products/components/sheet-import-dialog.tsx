import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { downloadTemplate, sheetJobQuery, uploadSheet } from "@/features/products/api/sheets"
import type { ImportSummary, SheetMode } from "@/features/products/api/sheets"
import { SheetJobResult } from "@/features/products/components/sheet-job-result"
import { errorText } from "@/lib/errors"

// What the file input takes; the server reads the bytes, not the name
const ACCEPT =
  ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"

function FilePicker({ file, onChange }: { file: File | null; onChange: (file: File) => void }) {
  const { t } = useTranslation()
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-muted/40">
      <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {file ? file.name : t("products.sheets.noFile")}
      </span>
      <span className="font-medium text-primary">{t("products.sheets.chooseFile")}</span>
      <input
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          if (chosen) {
            onChange(chosen)
          }
        }}
      />
    </label>
  )
}

/** Product sheet in (F3.9): the template, the file, a check that says what it would do, then the import. */
export function SheetImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const job = useQuery(sheetJobQuery(jobId)).data
  const summary =
    job?.status === "succeeded" ? (job.result_summary as unknown as ImportSummary) : null
  const running = sending || job?.status === "queued" || job?.status === "running"
  const close = () => {
    onOpenChange(false)
    setFile(null)
    setJobId(null)
    if (summary?.mode === "apply") {
      void client.invalidateQueries({ queryKey: ["products"] })
    }
  }
  const send = async (mode: SheetMode) => {
    if (!file) {
      return
    }
    setSending(true)
    try {
      setJobId((await uploadSheet(file, mode)).id)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setSending(false)
    }
  }
  const canApply = summary?.mode === "check" && summary.create + summary.update > 0
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true)
        } else {
          close()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("products.sheets.importTitle")}</DialogTitle>
          <DialogDescription>{t("products.sheets.importHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Button
              variant="link"
              className="h-auto self-start p-0"
              onClick={() => {
                downloadTemplate().catch((failure: unknown) => toast.error(errorText(t, failure)))
              }}
            >
              {t("products.sheets.template")}
            </Button>
            <p className="text-[13px] text-muted-foreground">{t("products.sheets.templateHint")}</p>
          </div>
          <FilePicker
            file={file}
            onChange={(next) => {
              setFile(next)
              setJobId(null)
            }}
          />
          {job ? <SheetJobResult job={job} /> : null}
          {summary?.mode === "check" && !canApply ? (
            <p className="text-sm text-muted-foreground">{t("products.sheets.nothing")}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t(summary?.mode === "apply" ? "products.sheets.done" : "common.cancel")}
          </Button>
          {canApply ? (
            <Button disabled={running} onClick={() => void send("apply")}>
              {running ? <Loader2 className="animate-spin" /> : <Upload />}
              {t("products.sheets.apply")}
            </Button>
          ) : summary?.mode !== "apply" ? (
            <Button disabled={!file || running} onClick={() => void send("check")}>
              {running ? <Loader2 className="animate-spin" /> : null}
              {t("products.sheets.check")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
