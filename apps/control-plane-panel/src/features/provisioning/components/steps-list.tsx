import {
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  LoaderCircle,
  TriangleAlert,
  Undo2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { RunStep, StepStatus } from "@/features/provisioning/api"
import {
  codeText,
  durationText,
  isWarning,
  outputText,
  stepName,
} from "@/features/provisioning/words"

const ICONS: Record<StepStatus, { icon: LucideIcon; tone: string }> = {
  pending: { icon: CircleDashed, tone: "text-muted-foreground" },
  running: { icon: LoaderCircle, tone: "text-info animate-spin motion-reduce:animate-none" },
  succeeded: { icon: CircleCheck, tone: "text-success" },
  skipped: { icon: CircleMinus, tone: "text-muted-foreground" },
  failed: { icon: CircleX, tone: "text-destructive" },
  compensated: { icon: Undo2, tone: "text-warning" },
}

/**
 * A run's steps in order (Ek C10): each with its icon and status in
 * words (the colour only supports them), its attempts, how long it took,
 * its non-secret outputs, and a failure or a warning in Turkish with the
 * control plane's code beside it.
 */
export function StepsList({
  steps,
  label,
  inset = true,
}: {
  steps: readonly RunStep[]
  label: string
  /** In a card, its rows run edge to edge with the card's padding; in a dialog, the dialog's. */
  inset?: boolean
}) {
  const { t } = useTranslation()
  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((step) => {
        const warning = isWarning(step)
        const { icon: Icon, tone } = warning
          ? { icon: TriangleAlert, tone: "text-warning" }
          : ICONS[step.status]
        const meta = [
          t(`setup.stepStatus.${step.status}`),
          step.attempts > 1 ? t("setup.attempts", { count: step.attempts }) : null,
          durationText(t, step.started_at, step.finished_at),
        ].filter(Boolean)
        const outputs = outputText(t, step)
        const problem = codeText(t, step.error_code)
        return (
          <li
            key={step.name}
            className={cn("flex gap-3 border-b py-3 last:border-b-0", inset && "px-5")}
            aria-current={step.status === "running" ? "step" : undefined}
          >
            <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone)} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-sm font-medium">{stepName(t, step.name)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {meta.join(" · ")}
                </span>
              </div>
              {outputs.length > 0 ? (
                <p className="text-[13px] leading-5 text-muted-foreground">{outputs.join(" · ")}</p>
              ) : null}
              {problem ? (
                <p
                  className={cn(
                    "text-[13px] leading-5",
                    warning ? "text-warning-text" : "text-destructive-text"
                  )}
                >
                  {problem}{" "}
                  <code className="font-mono text-xs text-muted-foreground">{step.error_code}</code>
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
