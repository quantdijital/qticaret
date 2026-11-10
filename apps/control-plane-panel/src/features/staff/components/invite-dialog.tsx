import { useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { INVITABLE_ROLES, useInvite } from "@/features/staff/api"
import type { InvitableRole, SentLink } from "@/features/staff/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"
import { RolePicker } from "./role-picker"

const EMAIL = z.email()

/**
 * A new member invited (owner, step-up): an address and a role; an owner
 * is never invited, an owner makes one from the team. The link goes by
 * e-mail, or comes back once to pass on.
 */
export function InviteDialog({
  open,
  onOpenChange,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: (sent: SentLink) => void
}) {
  const { t } = useTranslation()
  const invite = useInvite()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InvitableRole>("operator")
  const [failure, setFailure] = useState<string | null>(null)
  const valid = EMAIL.safeParse(email.trim()).success
  const close = (next: boolean) => {
    if (!next) {
      setEmail("")
      setRole("operator")
      setFailure(null)
      invite.reset()
    }
    onOpenChange(next)
  }
  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title={t("staff.invite.title")}
      description={t("staff.invite.text")}
      dirty={email !== ""}
      saving={invite.isPending}
      canSubmit={valid}
      submitLabel={t("staff.invite.submit")}
      onSubmit={() => {
        setFailure(null)
        invite.mutate(
          { email: email.trim().toLowerCase(), role },
          {
            onSuccess: (sent) => {
              close(false)
              onSent(sent)
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
          <Label htmlFor="invite-email">{t("staff.invite.email")}</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-3">
          <p id="invite-role-label" className="text-sm font-medium">
            {t("staff.invite.role")}
          </p>
          <RolePicker id="invite-role" roles={INVITABLE_ROLES} value={role} onChange={setRole} />
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
