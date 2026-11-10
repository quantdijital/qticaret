import { Check, Copy } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { renderSVG } from "uqr"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { StartedFactor } from "@/features/enrol/api"

/** The new factor as an authenticator app takes it: the QR code, or its key typed in. */
export function AuthenticatorLink({ factor }: { factor: StartedFactor }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  // Drawn here from the otpauth URL; the secret never leaves the page
  const image = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(factor.otpauth_url))}`,
    [factor.otpauth_url]
  )
  const grouped = factor.secret.match(/.{1,4}/g)?.join(" ") ?? factor.secret
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      {/* Dark modules on white, whatever the theme: cameras read it so */}
      <img src={image} alt={t("enrol.qr")} className="size-40 shrink-0 rounded-md bg-white p-2" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[13px] text-muted-foreground">{t("enrol.manual")}</p>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span
            aria-label={t("enrol.key")}
            className="min-w-0 flex-1 font-mono text-sm break-all select-all"
          >
            {grouped}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("enrol.copyKey")}
            onClick={() => {
              navigator.clipboard.writeText(factor.secret).then(
                () => {
                  setCopied(true)
                },
                () => toast.error(t("common.copyFailed"))
              )
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </div>
    </div>
  )
}
