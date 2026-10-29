import { RotateCcw, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useResendInvite, useWithdrawInvite } from "@/features/settings/api/team"
import type { TeamInvite } from "@/features/settings/api/team"
import { InviteLink } from "@/features/settings/components/invite-dialog"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"

const T = "settings.team"

/** The open invitations (the owner's): sent again with a new link, or withdrawn. */
export function TeamInvitesCard({ invites }: { invites: readonly TeamInvite[] }) {
  const { t } = useTranslation()
  const resend = useResendInvite()
  const withdraw = useWithdrawInvite()
  const [link, setLink] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<TeamInvite | null>(null)
  return (
    <SectionCard title={t(`${T}.invites`)} description={t(`${T}.invitesHint`)} flush>
      {invites.length === 0 ? (
        <p className="border-t px-5 py-4 text-sm text-muted-foreground">{t(`${T}.noInvites`)}</p>
      ) : (
        <ul>
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3"
            >
              <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{invite.email}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`staff.roles.${invite.role}`)} ·{" "}
                  {invite.expired
                    ? t(`${T}.expired`)
                    : t(`${T}.expires`, { when: formatDateTime(invite.expires_at) })}
                </span>
              </div>
              {invite.expired ? (
                <StatusBadge tone="warning">{t(`${T}.expiredBadge`)}</StatusBadge>
              ) : null}
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resend.isPending}
                  onClick={() => {
                    resend.mutate(invite.id, {
                      onSuccess: (made) => {
                        setLink(made.link)
                      },
                      onError: (failure) => toast.error(errorText(t, failure)),
                    })
                  }}
                >
                  <RotateCcw />
                  {t(`${T}.resend`)}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLeaving(invite)
                  }}
                >
                  <X />
                  {t(`${T}.withdraw`)}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={link !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLink(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t(`${T}.resentTitle`)}</DialogTitle>
            <DialogDescription>{t(`${T}.invitedHint`)}</DialogDescription>
          </DialogHeader>
          {link ? <InviteLink link={link} /> : null}
          <DialogFooter>
            <Button
              onClick={() => {
                setLink(null)
              }}
            >
              {t(`${T}.done`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLeaving(null)
          }
        }}
        title={t(`${T}.withdrawTitle`)}
        description={t(`${T}.withdrawHint`, { email: leaving?.email ?? "" })}
        confirmLabel={t(`${T}.withdraw`)}
        destructive
        onConfirm={() => {
          if (leaving) {
            withdraw.mutate(leaving.id, {
              onSuccess: () => toast.success(t(`${T}.withdrawn`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
          setLeaving(null)
        }}
      />
    </SectionCard>
  )
}
