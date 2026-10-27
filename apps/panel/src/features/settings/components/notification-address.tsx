import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isPublicOrigin } from "@/features/settings/payments"

const A = "settings.payments.address"

/**
 * An address the shop pastes into a provider's own panel, where payment
 * results arrive. It is copied, not typed: a typo would lose every payment
 * result. Selectable as well, for a browser that refuses the clipboard.
 */
export function NotificationAddress({
  id,
  url,
  label,
  hint,
}: {
  id: string
  url: string
  label: string
  /** Where in the provider's panel it goes. */
  hint: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id={id}
          readOnly
          value={url}
          aria-label={label}
          aria-describedby={`${id}-hint`}
          className="font-mono text-[13px] md:text-[13px]"
          onFocus={(event) => {
            event.currentTarget.select()
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t(`${A}.copy`)}
          aria-describedby={id}
          onClick={() => {
            navigator.clipboard.writeText(url).then(
              () => {
                setCopied(true)
                toast.success(t(`${A}.copied`))
              },
              () => toast.error(t(`${A}.copyFailed`))
            )
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
      {isPublicOrigin(new URL(url).origin) ? null : (
        <p className="text-xs text-warning-text">{t(`${A}.notPublic`)}</p>
      )}
    </div>
  )
}
