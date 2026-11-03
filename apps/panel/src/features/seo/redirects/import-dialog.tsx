import { CircleCheck, FileUp, Loader2, TriangleAlert } from "lucide-react"
import { useRef, useState } from "react"
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
import { useImportRedirects } from "@/features/seo/api/redirects"
import type { ImportReport } from "@/features/seo/api/redirects"
import { downloadCsv } from "@/lib/csv"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

// The server takes 1000 rows; a file far beyond that is refused before upload
const MAX_FILE_BYTES = 1_000_000
const SHOWN_PROBLEMS = 20

const TEMPLATE = [
  ["source", "target", "status", "match", "query_policy", "query_keep"],
  ["/eski-urun", "/urun/yeni-urun", 301, "exact", "keep", ""],
  ["/eski-kategori", "/kategori/yeni", 301, "prefix", "keep", ""],
  ["/kampanya-2024", "", 410, "exact", "keep", ""],
]

function Report({ report }: { report: ImportReport }) {
  const { t } = useTranslation()
  if (report.problems.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-success-soft px-3 py-2.5 text-[13px] text-success-text">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("seo.redirects.import.ready", {
          created: formatCount(report.created),
          updated: formatCount(report.updated),
        })}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] text-warning-text">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("seo.redirects.import.problems", { count: report.problems.length })}
      </p>
      <ul className="flex max-h-60 flex-col divide-y overflow-y-auto rounded-md border text-[13px]">
        {report.problems.slice(0, SHOWN_PROBLEMS).map((problem) => (
          <li key={`${String(problem.line)}-${problem.code}`} className="flex gap-3 px-3 py-2">
            <span className="w-16 shrink-0 text-muted-foreground tabular-nums">
              {t("seo.redirects.import.line", { line: problem.line })}
            </span>
            <span className="min-w-0">{problem.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A redirect file from a crawler, a spreadsheet or another platform
 * (docs/13 §4): checked whole first, then applied whole, or not at all.
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const run = useImportRedirects()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; csv: string } | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)

  const reset = () => {
    setFile(null)
    setReport(null)
    run.reset()
  }
  const check = async (chosen: File) => {
    if (chosen.size > MAX_FILE_BYTES) {
      toast.error(t("seo.redirects.import.tooLarge"))
      return
    }
    const csv = await chosen.text()
    setFile({ name: chosen.name, csv })
    setReport(null)
    run.mutate(
      { csv, dryRun: true },
      { onSuccess: setReport, onError: (error) => toast.error(errorText(t, error)) }
    )
  }
  const apply = () => {
    if (!file) {
      return
    }
    run.mutate(
      { csv: file.csv, dryRun: false },
      {
        onSuccess: (result) => {
          if (result.applied) {
            toast.success(
              t("seo.redirects.import.done", { count: result.created + result.updated })
            )
            onOpenChange(false)
            reset()
          } else {
            setReport(result)
          }
        },
        onError: (error) => toast.error(errorText(t, error)),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("seo.redirects.import.title")}</DialogTitle>
          <DialogDescription>{t("seo.redirects.import.description")}</DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            event.target.value = ""
            if (chosen) {
              void check(chosen)
            }
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors hover:bg-muted/50"
        >
          <FileUp className="size-6 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">
            {file ? file.name : t("seo.redirects.import.choose")}
          </span>
          <span className="text-xs text-muted-foreground">{t("seo.redirects.import.columns")}</span>
        </button>
        <Button
          variant="link"
          size="sm"
          className="h-auto self-start p-0 text-xs"
          onClick={() => {
            downloadCsv("yonlendirme-sablonu.csv", TEMPLATE)
          }}
        >
          {t("seo.redirects.import.template")}
        </Button>
        {run.isPending && !report ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("seo.redirects.import.checking")}
          </p>
        ) : null}
        {report ? <Report report={report} /> : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={run.isPending}
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button disabled={!report || report.problems.length > 0 || run.isPending} onClick={apply}>
            {run.isPending && report ? <Loader2 className="animate-spin" /> : null}
            {t("seo.redirects.import.apply", {
              count: report ? report.created + report.updated : 0,
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
