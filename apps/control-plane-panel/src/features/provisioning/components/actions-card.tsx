import { Mail, Play, RotateCcw, Square, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useRunAction } from "@/features/provisioning/api"
import type { ProvisioningState, RunAction } from "@/features/provisioning/api"
import { actionRules, lastKnownRunning } from "@/features/provisioning/rules"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

const ORDER: readonly RunAction[] = ["create", "start", "stop", "invite"]

/**
 * The setup's actions (Ek C10), each behind a step-up, each offered by the
 * control plane's rules (rules.ts) with the reason when it cannot start:
 * set up ("Kur", then "Yeniden dene"), start, stop (asked first: the shop
 * goes down) and send the owner's invitation again. Every button is the
 * same size; the shop's last known state is said above them.
 */
export function ActionsCard({
  tenantId,
  status,
  state,
}: {
  tenantId: string
  status: TenantStatus
  state: ProvisioningState | undefined
}) {
  const { t } = useTranslation()
  const run = useRunAction(tenantId)
  const [failure, setFailure] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)
  const rules = actionRules(state, status)
  const running = state ? lastKnownRunning(state) : null
  const labels: Record<RunAction, { text: string; icon: LucideIcon }> = {
    create: {
      text: t(rules.createLabel),
      icon: rules.createLabel === "setup.actions.install" ? Wrench : RotateCcw,
    },
    start: { text: t("setup.actions.start"), icon: Play },
    stop: { text: t("setup.actions.stop"), icon: Square },
    invite: { text: t("setup.actions.invite"), icon: Mail },
  }
  const go = (action: RunAction) => {
    setFailure(null)
    run.mutate(action, {
      onSuccess: () => {
        toast.success(t(`setup.started.${action}`))
      },
      onError: (error) => {
        if (!isStepUpCancelled(error)) {
          setFailure(errorText(t, error))
        }
      },
    })
  }
  const reasons = [
    ...new Set(
      ORDER.map((action) => rules[action].reason).filter((reason): reason is string => !!reason)
    ),
  ]
  return (
    <SectionCard
      title={t("setup.actionsTitle")}
      description={
        running === null
          ? t("setup.stateUnknown")
          : t(running ? "setup.stateRunning" : "setup.stateStopped")
      }
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {ORDER.map((action) => {
          const { text, icon: Icon } = labels[action]
          return (
            <Button
              key={action}
              variant={action === "create" ? "default" : "outline"}
              className="w-full justify-start"
              disabled={!rules[action].enabled || run.isPending}
              onClick={() => {
                if (action === "stop") {
                  setStopping(true)
                } else {
                  go(action)
                }
              }}
            >
              <Icon aria-hidden="true" />
              {text}
            </Button>
          )
        })}
      </div>
      {reasons.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-[13px] leading-5 text-muted-foreground">
          {reasons.map((reason) => (
            <li key={reason}>{t(reason)}</li>
          ))}
        </ul>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {failure}
        </p>
      ) : null}
      <ConfirmDialog
        open={stopping}
        onOpenChange={setStopping}
        title={t("setup.confirmStop.title")}
        description={t("setup.confirmStop.text")}
        confirmLabel={t("setup.actions.stop")}
        destructive
        onConfirm={() => {
          setStopping(false)
          go("stop")
        }}
      />
    </SectionCard>
  )
}
