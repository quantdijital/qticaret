import { useQuery } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Avatar, AvatarFallback } from "@qticaret/admin-ui/ui/avatar"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { myProfileQuery, useUpdateProfile } from "@/features/settings/api/account"
import type { MyProfile } from "@/features/settings/api/account"
import { fullNameOf, initialsOf } from "@/features/settings/my-account"
import { errorText } from "@/lib/errors"
import { formatLongDate } from "@qticaret/admin-ui/lib/format"

const P = "settings.security.profile"
const NAME_MAX = 100
const TITLE_MAX = 80

type Profile = MyProfile["profile"]

/** "Düzenle": the member's own first and last name and job title (the owner, 2026-11-06). */
export function ProfileDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateProfile()
  const saved = {
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    job_title: profile.job_title ?? "",
  }
  const [values, setValues] = useState(saved)
  const [failure, setFailure] = useState<string | null>(null)
  const dirty = (Object.keys(saved) as (keyof typeof saved)[]).some(
    (key) => values[key] !== saved[key]
  )
  const missing = values.first_name.trim() === "" || values.last_name.trim() === ""
  const field = (key: keyof typeof saved) => ({
    id: `profile-${key}`,
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues({ ...values, [key]: event.target.value })
    },
  })

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${P}.editTitle`)}
      description={t(`${P}.editHint`)}
      size="sm"
      dirty={dirty}
      saving={update.isPending}
      canSubmit={!missing}
      onSubmit={() => {
        setFailure(null)
        update.mutate(
          {
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            job_title: values.job_title.trim() || null,
          },
          {
            onSuccess: () => {
              toast.success(t(`${P}.saved`))
              onClose()
            },
            onError: (error) => {
              setFailure(errorText(t, error))
            },
          }
        )
      }}
    >
      <DialogBody>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t(`${P}.firstName`)} htmlFor="profile-first_name" required>
            <Input
              placeholder={t("common.placeholder.firstName")}
              {...field("first_name")}
              autoComplete="given-name"
              maxLength={NAME_MAX}
            />
          </Field>
          <Field label={t(`${P}.lastName`)} htmlFor="profile-last_name" required>
            <Input
              placeholder={t("common.placeholder.lastName")}
              {...field("last_name")}
              autoComplete="family-name"
              maxLength={NAME_MAX}
            />
          </Field>
        </div>
        <Field label={t(`${P}.jobTitle`)} htmlFor="profile-job_title" hint={t(`${P}.jobTitleHint`)}>
          <Input
            {...field("job_title")}
            autoComplete="organization-title"
            maxLength={TITLE_MAX}
            placeholder={t(`${P}.jobTitlePlaceholder`)}
          />
        </Field>
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{children}</dd>
    </div>
  )
}

/**
 * "Profilim" (the owner, 2026-11-06): who the signed-in member is, as the
 * shop's team sees them; their name and job title edited here. Any role.
 */
export function MyProfileCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(myProfileQuery())
  const [editing, setEditing] = useState(false)
  const profile = query.data?.profile

  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(`${P}.hint`)}
      className={className}
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={!profile}
          onClick={() => {
            setEditing(true)
          }}
        >
          <Pencil />
          {t("common.edit")}
        </Button>
      }
    >
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !profile ? (
        <LoadingRows rows={2} />
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4 sm:w-80 sm:shrink-0">
            <Avatar className="size-14">
              <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
                {initialsOf(profile)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-base font-semibold">{fullNameOf(profile)}</span>
              <span className="truncate text-sm text-muted-foreground">
                {profile.job_title ?? t(`${P}.noJobTitle`)}
              </span>
            </div>
          </div>
          <dl className="grid min-w-0 flex-1 gap-4 sm:grid-cols-3">
            <Fact label={t(`${P}.role`)}>
              {profile.role ? (
                <Badge variant="secondary">{t(`staff.roles.${profile.role}`)}</Badge>
              ) : (
                "—"
              )}
            </Fact>
            <Fact label={t(`${P}.email`)}>{profile.email}</Fact>
            <Fact label={t(`${P}.since`)}>{formatLongDate(profile.created_at)}</Fact>
          </dl>
        </div>
      )}
      {editing && profile ? (
        <ProfileDialog
          profile={profile}
          onClose={() => {
            setEditing(false)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
