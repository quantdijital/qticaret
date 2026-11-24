import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { AI_KEY, aiServicesQuery } from "@/features/ai/api/ai"
import { useStaff } from "@/features/auth/api/staff"
import { useFeatureState, useSetFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { AI_ASSISTANT_FLAG } from "./assistant-state"

const S = "ai.assistant.setting"

/**
 * Settings › Yapay zekâ: the panel assistant in one line (adr/0079 §6,
 * §8), off until the owner turns it on. Turning it on asks first, saying
 * what it does, where staff's words go and how long they are kept. With
 * no connected service whose tool calling is verified it cannot be
 * turned on, and says to connect one; once on, it can always be turned off.
 */
export function AssistantSetting() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const enabled = useFeatureState(AI_ASSISTANT_FLAG)
  const services = useQuery(aiServicesQuery())
  const mayChange = useStaff()?.role === "owner"
  const toggle = useSetFeature()
  const [asking, setAsking] = useState(false)
  const hintId = useId()
  const title = t(`${S}.title`)
  const serviceReady = (services.data?.assistant_services?.length ?? 0) > 0
  const blocked = enabled === false && services.data !== undefined && !serviceReady

  const set = (next: boolean) => {
    toggle.mutate(
      { key: AI_ASSISTANT_FLAG, enabled: next },
      {
        onSuccess: () => {
          toast.success(t("settings.saved"))
          void client.invalidateQueries({ queryKey: AI_KEY })
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <section className="flex min-h-14 items-center gap-4 rounded-lg border bg-card px-5 py-3 text-card-foreground shadow-card">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="flex items-center gap-1.5 text-[15px] leading-6 font-semibold">
          {title}
          <InfoTip
            name={title}
            hintId={hintId}
            hint={
              <span className="flex flex-col gap-1.5">
                <span>{t(`${S}.description`)}</span>
                <span>{t(`${S}.detail`)}</span>
              </span>
            }
          />
        </h2>
        <HiddenHint id={hintId}>
          {t(`${S}.description`)} {t(`${S}.detail`)}
        </HiddenHint>
        {!mayChange ? (
          <p className="text-[13px] leading-5 text-muted-foreground">{t(`${S}.ownerOnly`)}</p>
        ) : blocked ? (
          <p className="text-[13px] leading-5 text-muted-foreground">{t(`${S}.connect`)}</p>
        ) : null}
      </div>
      <Switch
        aria-label={title}
        aria-describedby={hintId}
        checked={enabled === true}
        disabled={enabled === undefined || !mayChange || blocked || toggle.isPending}
        onCheckedChange={(next) => {
          if (next) {
            setAsking(true)
          } else {
            set(false)
          }
        }}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${S}.confirmTitle`)}
        description={t(`${S}.confirmDescription`)}
        confirmLabel={t(`${S}.confirmAction`)}
        onConfirm={() => {
          set(true)
        }}
      >
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-5">
          <li>{t(`${S}.confirmWhat`)}</li>
          <li>{t(`${S}.confirmWhere`)}</li>
          <li>{t(`${S}.confirmKeep`)}</li>
        </ul>
      </ConfirmDialog>
    </section>
  )
}
