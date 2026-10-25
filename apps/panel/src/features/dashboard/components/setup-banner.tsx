import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Stepper } from "@/components/patterns/stepper"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { setupFactsQuery } from "@/features/dashboard/api/setup"
import { setupStatus } from "@/features/dashboard/setup-steps"
import type { SetupStatus, SetupStepKey } from "@/features/dashboard/setup-steps"
import { advancedPanelUrl } from "@/lib/advanced-panel"

const HIDDEN_KEY = "qt.panel.setup-hidden"

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === "1"
  } catch {
    // Storage blocked: the banner shows until setup is done
    return false
  }
}

function NextStep({ status, selected }: { status: SetupStatus; selected: SetupStepKey }) {
  const { t } = useTranslation()
  const entry = status.steps.find(({ step }) => step.key === selected)
  if (!entry) {
    return null
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{t(`dashboard.setup.steps.${selected}.title`)}</span>
        <span className="text-[13px] text-muted-foreground">
          {t(`dashboard.setup.steps.${selected}.description`)}
        </span>
      </div>
      {!entry.isDone ? (
        <Button asChild size="sm" className="shrink-0">
          <a href={advancedPanelUrl(entry.step.advancedPath)} target="_blank" rel="noreferrer">
            {t("dashboard.setup.continue")}
            <ArrowUpRight />
          </a>
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Setup as stages (docs/17): a stepper across the page, the next open step
 * spelled out with its action. Gone once every step is done; the owner
 * may hide it sooner in this browser.
 */
export function SetupBanner() {
  const { t } = useTranslation()
  const { data } = useQuery(setupFactsQuery())
  const [hidden, setHidden] = useState(readHidden)
  const [selected, setSelected] = useState<SetupStepKey | null>(null)
  const status = data ? setupStatus(data) : null
  if (!status?.nextKey || hidden) {
    return null
  }
  const total = status.steps.length
  return (
    <section className="flex flex-col gap-5 rounded-lg border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold">{t("dashboard.setup.title")}</h2>
            <p className="text-[13px] text-muted-foreground">{t("dashboard.setup.subtitle")}</p>
          </div>
          <div className="flex max-w-md items-center gap-3">
            <Progress value={(status.doneCount / total) * 100} className="h-1.5" />
            <span className="tabular shrink-0 text-xs text-muted-foreground">
              {t("dashboard.setup.progress", { done: status.doneCount, total })}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("dashboard.setup.hide")}
          onClick={() => {
            try {
              window.localStorage.setItem(HIDDEN_KEY, "1")
            } catch {
              // Storage blocked: hidden for this visit only
            }
            setHidden(true)
          }}
        >
          <X />
        </Button>
      </div>
      <Stepper
        steps={status.steps.map(({ step, isDone }) => ({
          key: step.key,
          title: t(`dashboard.setup.steps.${step.key}.title`),
          done: isDone,
        }))}
        currentKey={status.nextKey}
        onSelect={(key) => {
          setSelected(key as SetupStepKey)
        }}
      />
      <NextStep status={status} selected={selected ?? status.nextKey} />
    </section>
  )
}
