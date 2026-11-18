import { Check, Copy, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"

const B = "settings.einvoice.birfatura.dialog"

/** The password as made: once, with a copy button; selectable for a browser that refuses the clipboard. */
function MadePassword({ token }: { token: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/40 p-4">
      <span className="text-sm font-medium text-warning-text">{t(`${B}.once`)}</span>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 font-mono text-sm break-all select-all">{token}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t(`${B}.copy`)}
          onClick={() => {
            navigator.clipboard.writeText(token).then(
              () => {
                setCopied(true)
                toast.success(t(`${B}.copied`))
              },
              () => toast.error(t(`${B}.copyFailed`))
            )
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  )
}

/**
 * The connection password's one dialog (adr/0072 §3): asked first when
 * one exists (the old one stops at once), then the new one, shown once.
 * Open while asking or while a password is in hand; closing lets it go.
 */
export function BirfaturaTokenDialog({
  confirming,
  token,
  pending,
  onConfirm,
  onClose,
}: {
  confirming: boolean
  token: string | null
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={confirming || token !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(token ? `${B}.madeTitle` : `${B}.renewTitle`)}</DialogTitle>
          <DialogDescription>{t(token ? `${B}.madeHint` : `${B}.renewHint`)}</DialogDescription>
        </DialogHeader>
        {token ? <MadePassword token={token} /> : null}
        <DialogFooter>
          {token ? (
            <Button onClick={onClose}>{t(`${B}.done`)}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" disabled={pending} onClick={onConfirm}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {t(`${B}.renew`)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
