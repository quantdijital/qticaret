import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useWriteKey } from "@/features/ai-credits/api/mutations"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

// The control plane's rule (PostProviderKey): printable ASCII, no spaces, 8 to 512
const KEY_RULE = /^[\x21-\x7e]{8,512}$/
const KEY_MAX = 512

/**
 * "Anahtar yaz / değiştir" (adr/0085 §2): a password field never filled
 * from anything (the key is never read back) and emptied the moment it
 * is sent, whatever the answer. Behind a step-up.
 */
export function KeyDialog({
  service,
  name,
  onClose,
}: {
  service: string
  name: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const write = useWriteKey(service)
  const [value, setValue] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const tooLong = value.length > KEY_MAX
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("aiCredits.providers.keyDialog.title", { service: name })}
      description={t("aiCredits.providers.keyDialog.text")}
      dirty={value !== ""}
      saving={write.isPending}
      canSubmit={KEY_RULE.test(value)}
      submitLabel={t("aiCredits.providers.keyDialog.submit")}
      onSubmit={() => {
        const key = value
        setValue("")
        setFailure(null)
        write.mutate(key, {
          onSuccess: () => {
            toast.success(t("aiCredits.providers.keyDialog.done"))
            onClose()
          },
          onError: (error) => {
            if (!isStepUpCancelled(error)) {
              setFailure(errorText(t, error))
            }
          },
        })
      }}
    >
      <DialogBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="provider-key">{t("aiCredits.providers.keyDialog.label")}</Label>
          <Input
            id="provider-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={tooLong || undefined}
            aria-describedby={tooLong ? "provider-key-long" : undefined}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
            }}
          />
          {/* Said, never cut: a key trimmed to fit would be a different, wrong key */}
          {tooLong ? (
            <p id="provider-key-long" className="text-[13px] text-destructive">
              {t("aiCredits.providers.keyDialog.tooLong", { max: KEY_MAX })}
            </p>
          ) : null}
          <p className="text-[13px] text-muted-foreground">
            {t("aiCredits.providers.keyDialog.help")}
          </p>
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}

/**
 * "Anahtarı sil": asked first; the routings to the service go with it.
 * Only the question: the card that stays on screen sends it (behind a
 * step-up) and says the answer, so closing this loses nothing.
 */
export function DeleteKeyDialog({
  name,
  onConfirm,
  onClose,
}: {
  name: string
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("aiCredits.providers.deleteDialog.title", { service: name })}
      description={t("aiCredits.providers.deleteDialog.text")}
      confirmLabel={t("aiCredits.providers.deleteDialog.confirm")}
      destructive
      onConfirm={onConfirm}
    />
  )
}
