import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { staffQuery, useWithdrawInvite } from "@/features/staff/api"
import type { SentLink, StaffInvite, StaffMember } from "@/features/staff/api"
import { InviteDialog } from "@/features/staff/components/invite-dialog"
import { MemberDialog } from "@/features/staff/components/member-dialog"
import { MemberStatus } from "@/features/staff/components/member-status"
import { memberName } from "@/features/staff/names"
import { SentLinkDialog } from "@/features/staff/components/sent-link-dialog"
import { errorText } from "@/lib/errors"

/**
 * The platform's staff (owner, adr/0061 §3.5): members with their role,
 * state and 2FA, a row opening the member; the open invitations below.
 * Inviting, changing a role, deactivating and resetting 2FA ask the
 * step-up; withdrawing an invitation does not (it only takes access away).
 */
export function StaffPage() {
  const { t } = useTranslation()
  const staff = useQuery(staffQuery())
  const withdraw = useWithdrawInvite()
  const walk = useRecordWalk(staff.data?.staff, (member) => member.id)
  const [inviting, setInviting] = useState(false)
  const [sent, setSent] = useState<{ link: SentLink; kind: "invite" | "enrol" } | null>(null)

  const memberColumns: Column<StaffMember>[] = [
    {
      key: "name",
      header: t("staff.columns.name"),
      cell: (member) => (
        <div className="flex min-w-0 flex-col">
          <button
            type="button"
            className="truncate text-left font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              walk.show(member)
            }}
          >
            {memberName(member)}
            {member.you ? ` (${t("staff.you")})` : ""}
          </button>
          {/* Under a name only: one known by address alone is not named twice */}
          {member.first_name || member.last_name ? (
            <span className="truncate text-xs text-muted-foreground">{member.email}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "role",
      header: t("staff.columns.role"),
      cell: (member) => (member.role ? t(`roles.${member.role}`) : "—"),
    },
    {
      key: "status",
      header: t("staff.columns.status"),
      cell: (member) => <MemberStatus member={member} />,
    },
    {
      key: "since",
      header: t("staff.columns.since"),
      className: "hidden md:table-cell",
      cell: (member) => formatDate(member.created_at),
    },
  ]

  const inviteColumns: Column<StaffInvite>[] = [
    { key: "email", header: t("staff.columns.email"), cell: (invite) => invite.email },
    {
      key: "role",
      header: t("staff.columns.role"),
      cell: (invite) => (invite.role ? t(`roles.${invite.role}`) : "—"),
    },
    {
      key: "expires",
      header: t("staff.columns.expires"),
      cell: (invite) =>
        invite.expired ? (
          <StatusBadge tone="neutral">{t("staff.inviteExpired")}</StatusBadge>
        ) : (
          formatDate(invite.expires_at)
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      align: "right",
      cell: (invite) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={withdraw.isPending}
          onClick={() => {
            withdraw.mutate(invite.id, {
              onSuccess: () => toast.success(t("staff.withdrawn")),
              onError: (error) => toast.error(errorText(t, error)),
            })
          }}
        >
          {t("staff.withdraw")}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("staff.title")}
        description={t("staff.text")}
        action={
          <Button
            onClick={() => {
              setInviting(true)
            }}
          >
            {t("staff.invite.open")}
          </Button>
        }
      />
      {staff.isError ? (
        <ErrorState text={errorText(t, staff.error)} onRetry={() => void staff.refetch()} />
      ) : (
        <>
          <SectionCard title={t("staff.members")} flush>
            <DataTable
              columns={memberColumns}
              rows={staff.data?.staff}
              rowKey={(member) => member.id}
              onRowClick={walk.show}
              loading={staff.isPending}
              empty={t("staff.empty")}
            />
          </SectionCard>
          <SectionCard title={t("staff.invites")} description={t("staff.invitesText")} flush>
            <DataTable
              columns={inviteColumns}
              rows={staff.data?.invites}
              rowKey={(invite) => invite.id}
              loading={staff.isPending}
              empty={t("staff.noInvites")}
            />
          </SectionCard>
        </>
      )}
      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        onSent={(link) => {
          setSent({ link, kind: "invite" })
        }}
      />
      <MemberDialog
        member={walk.open}
        steps={walk.steps}
        onClose={walk.close}
        onSent={(link) => {
          // One dialog at a time: the link's, in place of the member's
          walk.close()
          setSent({ link, kind: "enrol" })
        }}
      />
      <SentLinkDialog
        sent={sent?.link ?? null}
        kind={sent?.kind ?? "invite"}
        onClose={() => {
          setSent(null)
        }}
      />
    </div>
  )
}
