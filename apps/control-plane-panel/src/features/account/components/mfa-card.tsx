import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { useNewRecoveryCodes, useTurnOffMfa } from "@/features/account/api"
import type { Me } from "@/features/auth/api"
import { RecoveryCodes } from "@/features/enrol/components/recovery-codes"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

/**
 * One's own 2FA (adr/0061 §3.5): always on, no switch. New recovery codes
 * (the old ones stop working) and a new phone (2FA off, set up again at
 * once) both ask the step-up.
 */
export function MfaCard({ me }: { me: Me }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const renew = useNewRecoveryCodes()
  const turnOff = useTurnOffMfa()
  const [codes, setCodes] = useState<string[] | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fail = (error: unknown) => {
    if (!isStepUpCancelled(error)) {
      toast.error(errorText(t, error))
    }
  }
  return (
    <SectionCard title={t("account.mfa.title")} description={t("account.mfa.text")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{t("account.mfa.status")}</span>
          <StatusBadge tone={me.mfa.enabled ? "success" : "warning"}>
            {t(me.mfa.enabled ? "account.mfa.on" : "account.mfa.off")}
          </StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={renew.isPending}
            onClick={() => {
              renew.mutate(undefined, { onSuccess: setCodes, onError: fail })
            }}
          >
            {t("account.mfa.newCodes")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={turnOff.isPending}
            onClick={() => {
              setConfirming(true)
            }}
          >
            {t("account.mfa.newPhone")}
          </Button>
        </div>
      </div>
      <DetailDialog
        open={codes !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCodes(null)
          }
        }}
        title={t("account.mfa.codesTitle")}
        description={t("account.mfa.codesText")}
        footer={
          <Button
            onClick={() => {
              setCodes(null)
            }}
          >
            {t("account.mfa.codesDone")}
          </Button>
        }
      >
        <DialogBody>{codes ? <RecoveryCodes codes={codes} /> : null}</DialogBody>
      </DetailDialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("account.mfa.newPhoneTitle")}
        description={t("account.mfa.newPhoneText")}
        confirmLabel={t("account.mfa.newPhoneConfirm")}
        destructive
        onConfirm={() => {
          turnOff.mutate(undefined, {
            onSuccess: () => void navigate({ to: "/security/setup" }),
            onError: fail,
          })
        }}
      />
    </SectionCard>
  )
}
