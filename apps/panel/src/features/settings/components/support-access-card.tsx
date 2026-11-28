import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { SecuritySettings } from "@/features/settings/api/sections"
import { supportAccessQuery, useEndSupportSession } from "@/features/support-access/api"
import type { SupportHistoryRow, SupportSessionRow } from "@/features/support-access/api"
import { errorText } from "@/lib/errors"

const S = "supportAccess.settings"

const time = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso)
      )
    : "—"

/**
 * Settings > Security > Destek erişimi (adr/0061 Ek "Destek erişimi",
 * Karar 4 and 6; the owner's alone): whether the platform's support may
 * come in, the sessions open now with "Sonlandır", and the last sign-ins.
 */
export function SupportAccessCard() {
  const { t } = useTranslation()
  const settings = useQuery(sectionQuery<SecuritySettings>("security"))
  const access = useQuery(supportAccessQuery())
  const save = useSaveSection<SecuritySettings>("security")
  const end = useEndSupportSession()
  const [next, setNext] = useState<boolean | null>(null)
  const [ending, setEnding] = useState<SupportSessionRow | null>(null)
  const enabled = settings.data?.values.support_access_enabled ?? true

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title={t(`${S}.title`)}
        description={t(`${S}.hint`)}
        action={
          <Switch
            aria-label={t(`${S}.title`)}
            checked={enabled}
            disabled={!settings.data || save.isPending}
            onCheckedChange={(on) => {
              setNext(on)
            }}
          />
        }
      >
        <p className="text-sm text-muted-foreground">
          {t(enabled ? `${S}.onState` : `${S}.offState`)}
        </p>
      </SectionCard>
      <SectionCard title={t(`${S}.openTitle`)} description={t(`${S}.openHint`)}>
        {access.isPending ? (
          <LoadingRows />
        ) : (access.data?.sessions.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t(`${S}.noneOpen`)}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {access.data?.sessions.map((row) => (
              <li
                key={row.grant_id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{row.operator_name}</p>
                  <p className="break-words text-muted-foreground">{row.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`${S}.endsAt`, { time: time(row.expires_at) })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEnding(row)
                  }}
                >
                  {t(`${S}.end`)}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title={t(`${S}.historyTitle`)} description={t(`${S}.historyHint`)}>
        {access.isPending ? (
          <LoadingRows />
        ) : (access.data?.history.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t(`${S}.noHistory`)}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {access.data?.history.map((row: SupportHistoryRow) => (
              <li key={`${row.grant_id ?? ""}${row.started_at}`} className="py-3 text-sm">
                <p className="font-medium">
                  {row.operator_name ?? "—"}
                  <span className="font-normal text-muted-foreground">
                    {" · "}
                    {time(row.started_at)}
                  </span>
                </p>
                <p className="break-words text-muted-foreground">{row.reason ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {row.ended_reason
                    ? t(`${S}.ended.${row.ended_reason}`, { time: time(row.ended_at) })
                    : t(`${S}.endsAt`, { time: time(row.expires_at) })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <ConfirmDialog
        open={next !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNext(null)
          }
        }}
        title={t(next ? `${S}.onTitle` : `${S}.offTitle`)}
        description={t(next ? `${S}.onConfirm` : `${S}.offConfirm`)}
        confirmLabel={t(next ? `${S}.turnOn` : `${S}.turnOff`)}
        destructive={next === false}
        onConfirm={() => {
          if (next !== null) {
            save.mutate(
              { support_access_enabled: next },
              {
                onSuccess: () => {
                  void access.refetch()
                  toast.success(t(next ? `${S}.turnedOn` : `${S}.turnedOff`))
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }
          setNext(null)
        }}
      />
      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEnding(null)
          }
        }}
        title={t(`${S}.endTitle`)}
        description={t(`${S}.endConfirm`, { name: ending?.operator_name ?? "" })}
        confirmLabel={t(`${S}.end`)}
        destructive
        onConfirm={() => {
          if (ending) {
            end.mutate(ending.grant_id, {
              onSuccess: () => toast.success(t(`${S}.endedToast`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
          setEnding(null)
        }}
      />
    </div>
  )
}
