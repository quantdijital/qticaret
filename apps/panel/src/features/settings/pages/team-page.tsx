import { useQuery } from "@tanstack/react-query"
import { ShieldOff, Trash2, UserPlus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCan } from "@/features/auth/api/staff"
import type { StaffRole } from "@/features/auth/api/staff"
import {
  STAFF_ROLES,
  teamQuery,
  useChangeRole,
  useRemoveMember,
  useResetMemberMfa,
} from "@/features/settings/api/team"
import type { TeamMember } from "@/features/settings/api/team"
import { InviteDialog } from "@/features/settings/components/invite-dialog"
import { TeamInvitesCard } from "@/features/settings/components/team-invites-card"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"

const T = "settings.team"

const ROLE_TONE: Record<StaffRole, StatusTone> = {
  owner: "info",
  admin: "success",
  operations: "neutral",
  readonly: "neutral",
}

const nameOf = (member: TeamMember) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email

interface Change {
  member: TeamMember
  role: StaffRole
}

/** One member: who, since when, their role (the owner changes it) and a way to take them off. */
function MemberRow({
  member,
  manage,
  onChange,
  onRemove,
  onResetMfa,
}: {
  member: TeamMember
  manage: boolean
  onChange: (change: Change) => void
  onRemove: (member: TeamMember) => void
  onResetMfa: (member: TeamMember) => void
}) {
  const { t } = useTranslation()
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3">
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{nameOf(member)}</span>
          {member.you ? <StatusBadge tone="info">{t(`${T}.you`)}</StatusBadge> : null}
          <StatusBadge tone={member.mfa ? "success" : "neutral"}>
            {t(member.mfa ? `${T}.mfaOn` : `${T}.mfaOff`)}
          </StatusBadge>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {member.email} · {t(`${T}.since`, { date: formatDate(member.created_at) })}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {manage ? (
          <Select
            value={member.role ?? ""}
            onValueChange={(role) => {
              onChange({ member, role: role as StaffRole })
            }}
          >
            <SelectTrigger className="w-40" aria-label={t(`${T}.roleOf`, { name: nameOf(member) })}>
              <SelectValue placeholder={t(`${T}.noRole`)} />
            </SelectTrigger>
            <SelectContent>
              {STAFF_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {t(`staff.roles.${role}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : member.role ? (
          <StatusBadge tone={ROLE_TONE[member.role]}>{t(`staff.roles.${member.role}`)}</StatusBadge>
        ) : (
          <StatusBadge tone="warning">{t(`${T}.noRole`)}</StatusBadge>
        )}
        {manage && !member.you && member.mfa ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t(`${T}.resetMfaOf`, { name: nameOf(member) })}
            onClick={() => {
              onResetMfa(member)
            }}
          >
            <ShieldOff />
          </Button>
        ) : manage ? (
          // The row keeps the button's room: the role pickers stay in one column
          <span aria-hidden className="size-9" />
        ) : null}
        {manage && !member.you ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t(`${T}.removeOf`, { name: nameOf(member) })}
            onClick={() => {
              onRemove(member)
            }}
          >
            <Trash2 />
          </Button>
        ) : manage ? (
          // One's own row keeps the button's room: the role pickers stay in one column
          <span aria-hidden className="size-9" />
        ) : null}
      </div>
    </li>
  )
}

/**
 * Settings > Team (F12.6, adr/0040): who works in the panel and with which
 * role. The owner invites, changes roles and takes people off; an admin
 * reads the list.
 */
export function TeamPage() {
  const { t } = useTranslation()
  const team = useQuery(teamQuery())
  const manage = useCan("staff")
  const change = useChangeRole()
  const remove = useRemoveMember()
  const resetMfa = useResetMemberMfa()
  const [resetting, setResetting] = useState<TeamMember | null>(null)
  const [inviting, setInviting] = useState(false)
  const [confirming, setConfirming] = useState<Change | null>(null)
  const [removing, setRemoving] = useState<TeamMember | null>(null)

  const apply = ({ member, role }: Change) => {
    change.mutate(
      { id: member.id, role },
      {
        onSuccess: () => toast.success(t(`${T}.changed`, { name: nameOf(member) })),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${T}.title`)}
        description={t(`${T}.description`)}
        action={
          manage ? (
            <Button
              onClick={() => {
                setInviting(true)
              }}
            >
              <UserPlus />
              {t(`${T}.invite`)}
            </Button>
          ) : undefined
        }
      />
      <SectionCard title={t(`${T}.members`)} description={t(`${T}.membersHint`)} flush>
        {team.isPending ? (
          <div className="border-t p-5">
            <LoadingRows />
          </div>
        ) : team.isError ? (
          <div className="border-t p-5">
            <ErrorState text={errorText(t, team.error)} onRetry={() => void team.refetch()} />
          </div>
        ) : (
          <ul>
            {team.data.staff.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                manage={manage}
                onChange={(next) => {
                  // Making an owner, or changing one's own role, is asked once more
                  if (next.role === "owner" || next.member.you) {
                    setConfirming(next)
                  } else {
                    apply(next)
                  }
                }}
                onRemove={setRemoving}
                onResetMfa={setResetting}
              />
            ))}
          </ul>
        )}
      </SectionCard>
      {team.data?.invites ? <TeamInvitesCard invites={team.data.invites} /> : null}
      <InviteDialog open={inviting} onOpenChange={setInviting} />
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null)
          }
        }}
        title={t(confirming?.role === "owner" ? `${T}.ownerTitle` : `${T}.selfTitle`)}
        description={t(confirming?.role === "owner" ? `${T}.ownerHint` : `${T}.selfHint`, {
          name: confirming ? nameOf(confirming.member) : "",
          role: confirming ? t(`staff.roles.${confirming.role}`) : "",
        })}
        confirmLabel={t(`${T}.confirmChange`)}
        onConfirm={() => {
          if (confirming) {
            apply(confirming)
          }
          setConfirming(null)
        }}
      />
      <ConfirmDialog
        open={resetting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetting(null)
          }
        }}
        title={t(`${T}.resetMfaTitle`)}
        description={t(`${T}.resetMfaHint`, { name: resetting ? nameOf(resetting) : "" })}
        confirmLabel={t(`${T}.resetMfa`)}
        destructive
        onConfirm={() => {
          if (resetting) {
            resetMfa.mutate(resetting.id, {
              onSuccess: () => toast.success(t(`${T}.mfaReset`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
          setResetting(null)
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={t(`${T}.removeTitle`)}
        description={t(`${T}.removeHint`, { name: removing ? nameOf(removing) : "" })}
        confirmLabel={t(`${T}.remove`)}
        destructive
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id, {
              onSuccess: () => toast.success(t(`${T}.removed`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
          setRemoving(null)
        }}
      />
    </div>
  )
}
