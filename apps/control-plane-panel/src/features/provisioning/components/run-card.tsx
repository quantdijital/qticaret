import { CircleX, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@qticaret/admin-ui/ui/alert"
import type { Run, RunStatus } from "@/features/provisioning/api"
import { codeText, isWarning, runLine, stepName } from "@/features/provisioning/words"
import { StepsList } from "./steps-list"

const TONES: Record<RunStatus, StatusTone> = {
  running: "info",
  succeeded: "success",
  failed: "danger",
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONES[status]}>{t(`setup.runStatus.${status}`)}</StatusBadge>
}

/** What went wrong with a run, and what went but warns (an invite not mailed). */
function RunNotes({ run }: { run: Run }) {
  const { t } = useTranslation()
  const warnings = (run.steps ?? []).filter(isWarning)
  return (
    <>
      {run.status === "failed" ? (
        <Alert variant="destructive">
          <CircleX aria-hidden="true" />
          <AlertTitle>{t("setup.failedTitle")}</AlertTitle>
          <AlertDescription>
            {codeText(t, run.error_code) ?? t("setup.unknownCode")} {t("setup.failedHint")}
          </AlertDescription>
        </Alert>
      ) : null}
      {warnings.map((step) => (
        <Alert key={step.name}>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t("setup.warningTitle", { step: stepName(t, step.name) })}</AlertTitle>
          <AlertDescription>
            {codeText(t, step.error_code)}
            {step.name === "owner_invite" || step.name === "resend_invite"
              ? ` ${t("setup.inviteHint")}`
              : ""}
          </AlertDescription>
        </Alert>
      ))}
    </>
  )
}

/** One run's body: its notes and steps (the latest run's card and a run's dialog). */
export function RunBody({ run, inset = true }: { run: Run; inset?: boolean }) {
  const { t } = useTranslation()
  const notes = run.status === "failed" || (run.steps ?? []).some(isWarning)
  return (
    <>
      {notes ? (
        <div className={inset ? "flex flex-col gap-3 px-5 pb-3" : "flex flex-col gap-3"}>
          <RunNotes run={run} />
        </div>
      ) : null}
      <StepsList steps={run.steps ?? []} label={t("setup.stepsLabel")} inset={inset} />
    </>
  )
}

/**
 * The latest run of the shop's setup (Ek C10): its kind, status and
 * steps as they go (the tab reads them every two seconds while it runs).
 * Before any run, what "Kur" will do.
 */
export function LatestRunCard({ run }: { run: Run | null }) {
  const { t } = useTranslation()
  if (!run) {
    return (
      <SectionCard title={t("setup.latestTitle")} description={t("setup.noneText")}>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-5 text-muted-foreground">
          {(["allocate", "database", "migrate", "start", "owner_invite", "activate"] as const).map(
            (step) => (
              <li key={step}>{stepName(t, step)}</li>
            )
          )}
        </ol>
      </SectionCard>
    )
  }
  return (
    <SectionCard
      title={t("setup.latestTitle")}
      description={runLine(t, run)}
      action={<RunStatusBadge status={run.status} />}
      flush
    >
      <RunBody run={run} />
    </SectionCard>
  )
}
