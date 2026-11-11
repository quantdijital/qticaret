import { Ban, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useMe } from "@/features/auth/api"
import { useMoveStatus } from "@/features/tenants/mutations"
import type { StatusMove } from "@/features/tenants/mutations"
import { canManageShops } from "@/features/tenants/permissions"
import { moveOf } from "@/features/tenants/status-move"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

const REASON_MIN = 3

function MoveDialog({
  tenantId,
  move,
  onClose,
}: {
  tenantId: string
  move: StatusMove
  onClose: () => void
}) {
  const { t } = useTranslation()
  const change = useMoveStatus(tenantId)
  const [reason, setReason] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`statusMove.${move}.title`)}
      description={t(`statusMove.${move}.text`)}
      dirty={reason !== ""}
      saving={change.isPending}
      canSubmit={reason.trim().length >= REASON_MIN}
      submitLabel={t(`statusMove.${move}.submit`)}
      onSubmit={() => {
        setFailure(null)
        change.mutate(
          { move, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success(t(`statusMove.${move}.done`))
              onClose()
            },
            onError: (error) => {
              if (!isStepUpCancelled(error)) {
                setFailure(errorText(t, error))
              }
            },
          }
        )
      }}
    >
      <DialogBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status-move-reason">{t("statusMove.reason")}</Label>
          <Textarea
            id="status-move-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
          />
          <p className="text-[13px] text-muted-foreground">{t("statusMove.reasonHelp")}</p>
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
 * "Askıya al" / "Geri aç" on the shop's page (adr/0061 §2, Ek C15): for
 * the owner and the operator, as the route table decides; a reason and a
 * step-up each time. Closing a shop is later (F16.11).
 */
export function StatusActions({ tenantId, status }: { tenantId: string; status: TenantStatus }) {
  const { t } = useTranslation()
  const me = useMe()
  const [open, setOpen] = useState(false)
  const move = moveOf(status)
  if (!move || !canManageShops(me?.role)) {
    return null
  }
  const Icon = move === "suspend" ? Ban : RotateCcw
  return (
    <>
      <Button
        variant={move === "suspend" ? "outline" : "default"}
        className={move === "suspend" ? "text-destructive" : undefined}
        onClick={() => {
          setOpen(true)
        }}
      >
        <Icon aria-hidden="true" />
        {t(`statusMove.${move}.open`)}
      </Button>
      {open ? (
        <MoveDialog
          tenantId={tenantId}
          move={move}
          onClose={() => {
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
