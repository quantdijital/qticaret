import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import type { SentLink } from "@/features/staff/api"

/**
 * A link the control plane made (an invitation, an enrolment after a 2FA
 * reset): sent by e-mail, or, when no e-mail went out, shown here once for
 * the owner to pass on. It is not stored anywhere; closing this forgets it.
 */
export function SentLinkDialog({
  sent,
  kind,
  onClose,
}: {
  sent: SentLink | null
  kind: "invite" | "enrol"
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <DetailDialog
      open={sent !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false)
          onClose()
        }
      }}
      title={t(`staff.sent.${kind}.title`)}
      description={t(sent?.mailed ? `staff.sent.${kind}.mailed` : `staff.sent.${kind}.byHand`)}
      footer={
        <Button
          onClick={() => {
            setCopied(false)
            onClose()
          }}
        >
          {t("common.done")}
        </Button>
      }
    >
      <DialogBody>
        {sent && !sent.mailed ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span
              aria-label={t("staff.sent.link")}
              className="min-w-0 flex-1 font-mono text-[13px] break-all select-all"
            >
              {sent.link}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("staff.sent.copy")}
              onClick={() => {
                navigator.clipboard.writeText(sent.link).then(
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
        ) : null}
        <p className="text-[13px] text-muted-foreground">{t(`staff.sent.${kind}.expiry`)}</p>
      </DialogBody>
    </DetailDialog>
  )
}
