import { Check, Copy, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { INVITABLE_ROLES, useInvite } from "@/features/settings/api/team"
import type { InvitableRole } from "@/features/settings/api/team"
import { usePlanFailureToast } from "@/features/settings/use-plan-failure"

const T = "settings.team"

/** An invitation's link, to copy: the e-mail may not reach, or the shop sends no e-mail yet. */
export function InviteLink({ link }: { link: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 p-3">
        <span className="min-w-0 flex-1 font-mono text-xs break-all select-all">{link}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t(`${T}.copy`)}
          onClick={() => {
            // Refused without the page's clipboard permission: the link stays selectable
            navigator.clipboard.writeText(link).then(
              () => {
                setCopied(true)
              },
              () => toast.error(t("settings.api.create.copyFailed"))
            )
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p className="text-[13px] text-muted-foreground">{t(`${T}.linkHint`)}</p>
    </div>
  )
}

/** A new member by invitation: their address and role; then the link, once (F12.6). */
export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const invite = useInvite()
  const planFailure = usePlanFailureToast()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InvitableRole>("operations")
  const [link, setLink] = useState<string | null>(null)
  const close = (next: boolean) => {
    if (!next) {
      setEmail("")
      setRole("operations")
      setLink(null)
      invite.reset()
    }
    onOpenChange(next)
  }
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${T}.inviteTitle`)}</DialogTitle>
          <DialogDescription>{t(link ? `${T}.invitedHint` : `${T}.inviteHint`)}</DialogDescription>
        </DialogHeader>
        {link ? (
          <InviteLink link={link} />
        ) : (
          <div className="flex flex-col gap-5">
            <Field label={t(`${T}.email`)} htmlFor="invite-email">
              <Input
                placeholder={t("common.placeholder.email")}
                id="invite-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                }}
              />
            </Field>
            <Field label={t(`${T}.role`)}>
              <RadioGroup
                value={role}
                onValueChange={(value) => {
                  setRole(value as InvitableRole)
                }}
                className="gap-2"
              >
                {INVITABLE_ROLES.map((each) => (
                  <label
                    key={each}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[[data-state=checked]]:border-primary"
                  >
                    <RadioGroupItem value={each} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{t(`staff.roles.${each}`)}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {t(`staff.roleHints.${each}`)}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
          </div>
        )}
        <DialogFooter>
          {link ? (
            <Button
              onClick={() => {
                close(false)
              }}
            >
              {t(`${T}.done`)}
            </Button>
          ) : (
            <>
              <Button
                variant="cancel"
                onClick={() => {
                  close(false)
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!valid || invite.isPending}
                onClick={() => {
                  invite.mutate(
                    { email: email.trim(), role },
                    {
                      onSuccess: (made) => {
                        setLink(made.link)
                      },
                      // Past the package's team limit: a link to Settings > Abonelik
                      onError: planFailure,
                    }
                  )
                }}
              >
                {invite.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${T}.send`)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
