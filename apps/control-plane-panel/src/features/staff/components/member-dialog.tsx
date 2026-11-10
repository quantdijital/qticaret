import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import type { StaffRole } from "@/features/auth/api"
import {
  STAFF_ROLES,
  useChangeRole,
  useDeactivate,
  useReactivate,
  useResetMfa,
} from "@/features/staff/api"
import type { SentLink, StaffMember } from "@/features/staff/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"
import { RolePicker } from "./role-picker"
import { memberName } from "@/features/staff/names"

type Asked = "deactivate" | "reactivate" | "reset" | null

/**
 * One member, opened from the staff list (docs/18 §7 DetailDialog): who
 * they are, their role (changed here), and the owner's actions in the
 * footer: deactivate or reactivate, reset 2FA. Every change asks the
 * step-up; none applies to oneself (the API refuses it too).
 */
export function MemberDialog({
  member,
  steps,
  onClose,
  onSent,
}: {
  member: StaffMember | null
  steps: RecordSteps
  onClose: () => void
  onSent: (sent: SentLink) => void
}) {
  const { t } = useTranslation()
  const changeRole = useChangeRole()
  const deactivate = useDeactivate()
  const reactivate = useReactivate()
  const reset = useResetMfa()
  const [role, setRole] = useState<StaffRole | null>(null)
  const [asked, setAsked] = useState<Asked>(null)
  const busy =
    changeRole.isPending || deactivate.isPending || reactivate.isPending || reset.isPending
  const fail = (error: unknown) => {
    if (!isStepUpCancelled(error)) {
      toast.error(errorText(t, error))
    }
  }
  const chosen = role ?? member?.role ?? "readonly"
  const roleChanged = member !== null && role !== null && role !== member.role
  const run = () => {
    if (!member || !asked) {
      return
    }
    const done = { onError: fail }
    if (asked === "deactivate") {
      deactivate.mutate(member.id, {
        ...done,
        onSuccess: () => toast.success(t("staff.member.deactivated")),
      })
    } else if (asked === "reactivate") {
      reactivate.mutate(member.id, {
        ...done,
        onSuccess: () => toast.success(t("staff.member.reactivated")),
      })
    } else {
      reset.mutate(member.id, { ...done, onSuccess: onSent })
    }
  }
  return (
    <>
      <DetailDialog
        open={member !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRole(null)
            onClose()
          }
        }}
        title={member ? memberName(member) : ""}
        description={member?.email}
        headerAction={
          <RecordStepper
            {...steps}
            onGo={(index) => {
              setRole(null)
              steps.onGo(index)
            }}
            previousLabel={t("staff.member.previous")}
            nextLabel={t("staff.member.next")}
          />
        }
        footer={
          member && !member.you ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setAsked("reset")
                }}
              >
                {t("staff.member.reset")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setAsked(member.active ? "deactivate" : "reactivate")
                }}
              >
                {t(member.active ? "staff.member.deactivate" : "staff.member.reactivate")}
              </Button>
            </>
          ) : undefined
        }
      >
        {member ? (
          <DialogBody>
            <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-[13px] text-muted-foreground">{t("staff.columns.mfa")}</dt>
                <dd>{t(member.mfa ? "staff.mfaOn" : "staff.mfaOff")}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[13px] text-muted-foreground">{t("staff.columns.since")}</dt>
                <dd>{formatDate(member.created_at)}</dd>
              </div>
            </dl>
            <DialogSection title={<span id="member-role-label">{t("staff.member.role")}</span>}>
              {member.you ? (
                <p className="text-sm text-muted-foreground">{t("staff.member.yourself")}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <RolePicker
                    id="member-role"
                    roles={STAFF_ROLES}
                    value={chosen}
                    onChange={setRole}
                  />
                  <Button
                    className="self-start"
                    size="sm"
                    disabled={!roleChanged || busy}
                    onClick={() => {
                      changeRole.mutate(
                        { id: member.id, role: chosen },
                        {
                          onSuccess: () => {
                            setRole(null)
                            toast.success(t("staff.member.roleSaved"))
                          },
                          onError: fail,
                        }
                      )
                    }}
                  >
                    {t("staff.member.saveRole")}
                  </Button>
                </div>
              )}
            </DialogSection>
          </DialogBody>
        ) : null}
      </DetailDialog>
      <ConfirmDialog
        open={asked !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAsked(null)
          }
        }}
        title={asked ? t(`staff.confirm.${asked}.title`) : ""}
        description={
          asked ? t(`staff.confirm.${asked}.text`, { name: member ? memberName(member) : "" }) : ""
        }
        confirmLabel={asked ? t(`staff.confirm.${asked}.action`) : ""}
        destructive={asked !== "reactivate"}
        onConfirm={run}
      />
    </>
  )
}
