import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { SectionCard } from "@/components/patterns/section-card"
import { Switch } from "@/components/ui/switch"
import { STAFF_KEY, useCan, useStaff } from "@/features/auth/api/staff"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { SecuritySettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const S = "settings.security.team"

/**
 * Whether the whole team must pass 2FA (F12.6, adr/0040 §2): the owner's
 * switch, asked once more either way. Off, a member who set 2FA up is
 * still asked for the code; the others sign in with a password.
 */
export function TeamMfaCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const staff = useStaff()
  const owner = useCan("security")
  const settings = useQuery(sectionQuery<SecuritySettings>("security"))
  const save = useSaveSection<SecuritySettings>("security")
  const [next, setNext] = useState<boolean | null>(null)
  const required = settings.data?.values.staff_mfa_required ?? true
  const available = staff?.mfa.available === true

  return (
    <SectionCard
      title={t(`${S}.title`)}
      description={t(!available ? `${S}.unavailable` : owner ? `${S}.hint` : `${S}.ownerOnly`)}
      action={
        <Switch
          aria-label={t(`${S}.title`)}
          checked={required}
          disabled={!owner || !settings.data || save.isPending}
          onCheckedChange={(on) => {
            setNext(on)
          }}
        />
      }
    >
      <p className="text-sm text-muted-foreground">
        {t(required ? `${S}.onState` : `${S}.offState`)}
      </p>
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
              { staff_mfa_required: next },
              {
                onSuccess: () => {
                  void client.invalidateQueries({ queryKey: STAFF_KEY })
                  toast.success(t(next ? `${S}.turnedOn` : `${S}.turnedOff`))
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }
          setNext(null)
        }}
      />
    </SectionCard>
  )
}
