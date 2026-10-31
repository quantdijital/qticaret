import { Loader2 } from "lucide-react"
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
import { useRotateWebhookSecret } from "@/features/settings/api/webhooks"
import type { WebhookSubscription } from "@/features/settings/api/webhooks"
import { MadeSecret } from "@/features/settings/components/webhook-dialog"
import { errorText } from "@/lib/errors"

const W = "settings.api.webhooks"

/**
 * A subscription's signing secret made anew (the F15 audit): asked first,
 * as the receiving system stops trusting the old one at once; then the
 * new one, shown once.
 */
export function WebhookSecretDialog({
  row,
  onClose,
}: {
  row: WebhookSubscription
  onClose: () => void
}) {
  const { t } = useTranslation()
  const rotate = useRotateWebhookSecret()
  const secret = rotate.data?.secret ?? null
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`${W}.rotateTitle`)}</DialogTitle>
          <DialogDescription>
            {t(secret ? `${W}.madeHint` : `${W}.rotateHint`, { url: row.url })}
          </DialogDescription>
        </DialogHeader>
        {secret ? <MadeSecret secret={secret} /> : null}
        <DialogFooter>
          {secret ? (
            <Button onClick={onClose}>{t("settings.api.create.done")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={rotate.isPending}
                onClick={() => {
                  rotate.mutate(row.id, {
                    onError: (failure) => toast.error(errorText(t, failure)),
                  })
                }}
              >
                {rotate.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${W}.rotate`)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
