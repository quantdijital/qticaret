import { Check, Copy, Download } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/** Recovery codes, shown once: to copy or to keep as a file (adr/0040 §2). */
export function RecoveryCodes({ codes }: { codes: readonly string[] }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const text = codes.join("\n")
  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label={t("security.codes.label")}
        className="grid gap-1.5 rounded-lg border border-dashed bg-muted/40 p-3 font-mono text-[11px] sm:p-4 sm:text-sm"
      >
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(text).then(
              () => {
                setCopied(true)
              },
              () => toast.error(t("settings.api.create.copyFailed"))
            )
          }}
        >
          {copied ? <Check /> : <Copy />}
          {t("security.codes.copy")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const link = document.createElement("a")
            link.href = URL.createObjectURL(new Blob([`${text}\n`], { type: "text/plain" }))
            link.download = t("security.codes.file")
            link.click()
            URL.revokeObjectURL(link.href)
          }}
        >
          <Download />
          {t("security.codes.download")}
        </Button>
      </div>
      <p className="text-[13px] text-muted-foreground">{t("security.codes.hint")}</p>
    </div>
  )
}
