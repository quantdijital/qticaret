import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { useSaveSection } from "@/features/settings/api/sections"
import type { MaintenanceSettings } from "@/features/storefront/api/maintenance"
import { MAINTENANCE_SECTION } from "@/features/storefront/api/maintenance"
import { errorText } from "@/lib/errors"
import { cn } from "@qticaret/admin-ui/lib/utils"

const S = "storefront.maintenance.status"

/**
 * The maintenance switch (adr/0053): saved at once, as the bank transfer's
 * is. Turning it on asks first: shoppers get the 503 page, and the save
 * ends every bypass link. Only the owner may flip it; the others see where
 * it stands.
 */
export function MaintenanceStatusCard({
  saved,
  canWrite,
}: {
  saved: MaintenanceSettings
  canWrite: boolean
}) {
  const { t } = useTranslation()
  const save = useSaveSection<MaintenanceSettings>(MAINTENANCE_SECTION)
  const [asking, setAsking] = useState(false)
  const store = (enabled: boolean) => {
    save.mutate(
      { enabled },
      {
        onSuccess: () => toast.success(t(enabled ? `${S}.turnedOn` : `${S}.turnedOff`)),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const on = saved.enabled
  return (
    <SectionCard
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      action={
        <StatusBadge tone={on ? "warning" : "neutral"}>
          {t(on ? `${S}.on` : `${S}.off`)}
        </StatusBadge>
      }
    >
      <div
        className={cn(
          "flex items-center justify-between gap-6 rounded-lg border px-4 py-4",
          on && "border-warning bg-warning-soft"
        )}
      >
        <label htmlFor="maintenance-enabled" className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-semibold">{t(`${S}.enabled`)}</span>
          <span
            id="maintenance-enabled-hint"
            // On the amber box its own text colour keeps the contrast
            className={cn("text-[13px]", on ? "text-warning-text" : "text-muted-foreground")}
          >
            {t(on ? `${S}.onHint` : `${S}.offHint`)}
          </span>
        </label>
        <Switch
          id="maintenance-enabled"
          aria-describedby="maintenance-enabled-hint"
          checked={on}
          disabled={!canWrite || save.isPending}
          className="origin-right scale-125"
          onCheckedChange={(enabled) => {
            if (enabled) {
              setAsking(true)
            } else {
              store(false)
            }
          }}
        />
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        {canWrite ? t(`${S}.seo`) : t(`${S}.ownerOnly`)}
      </p>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${S}.confirmTitle`)}
        description={t(`${S}.confirmText`)}
        confirmLabel={t(`${S}.confirm`)}
        onConfirm={() => {
          store(true)
        }}
      />
    </SectionCard>
  )
}
