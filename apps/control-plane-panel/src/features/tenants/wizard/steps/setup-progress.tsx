import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { errorText } from "@/lib/errors"
import { SETUP_PARTS } from "../setup-sequence"
import type { PartState, SetupProgress } from "../setup-sequence"

const ICONS: Record<Exclude<PartState, "skipped">, { icon: LucideIcon; tone: string }> = {
  waiting: { icon: CircleDashed, tone: "text-muted-foreground" },
  running: { icon: LoaderCircle, tone: "text-info animate-spin motion-reduce:animate-none" },
  done: { icon: CircleCheck, tone: "text-success" },
  failed: { icon: CircleX, tone: "text-destructive" },
}

/** "Kur" as it goes: each part this shop has, its state in words, a failure's reason. */
export function SetupProgressList({ progress }: { progress: SetupProgress }) {
  const { t } = useTranslation()
  return (
    <ol aria-label={t("wizard.review.progressLabel")} className="flex flex-col gap-2">
      {SETUP_PARTS.map((part) => {
        const { state, error } = progress.parts[part]
        if (state === "skipped") {
          return null
        }
        const { icon: Icon, tone } = ICONS[state]
        return (
          <li key={part} className="flex gap-3 text-sm">
            <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone)} />
            <div className="flex min-w-0 flex-col">
              <span>
                {t(`wizard.parts.${part}`)}
                <span className="text-muted-foreground"> · {t(`wizard.partState.${state}`)}</span>
              </span>
              {state === "failed" ? (
                <span className="text-[13px] leading-5 text-destructive-text">
                  {errorText(t, error)}
                </span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
