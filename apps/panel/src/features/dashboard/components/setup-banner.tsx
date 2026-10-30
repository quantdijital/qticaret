import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Stepper } from "@/components/patterns/stepper"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useCan } from "@/features/auth/api/staff"
import { setupFactsQuery } from "@/features/dashboard/api/setup"
import { setupStatus } from "@/features/dashboard/setup-steps"
import type { SetupStatus, SetupStepKey } from "@/features/dashboard/setup-steps"

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
      {entry.isDone ? null : entry.step.panelPath ? (
        <Button asChild size="sm" className="shrink-0">
          <Link to={entry.step.panelPath}>
            {t("dashboard.setup.continue")}
            <ArrowRight />
          </Link>
        </Button>
      ) : (
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {t("dashboard.setup.byInstall")}
        </span>
      )}
    </div>
  )
}

/**
 * Setup as stages (docs/17): a stepper across the page, the next open step
 * spelled out with its action. Gone once every step is done; the owner
 * may hide it sooner in this browser. When the steps cannot be read, a
 * line says so with a retry.
 */
export function SetupBanner() {
  const { t } = useTranslation()
  // Setting the shop up is for those who may change its settings (adr/0040);
  // its accounts are not even readable for the others
  const allowed = useCan("settings")
  const facts = useQuery({ ...setupFactsQuery(), enabled: allowed })
  const [hidden, setHidden] = useState(readHidden)
  const [selected, setSelected] = useState<SetupStepKey | null>(null)
  if (hidden || !allowed) {
    return null
  }
  // Not known: say so, rather than let a shop not yet set up miss its steps
  if (facts.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-lg border bg-card px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-[13px] text-muted-foreground">{t("dashboard.setup.failed")}</p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void facts.refetch()}
        >
          {t("common.retry")}
        </Button>
      </div>
    )
  }
  // While it loads nothing is drawn: most shops are set up, and a placeholder
  // that then vanishes would move the whole page
  const status = facts.data ? setupStatus(facts.data) : null
  if (!status?.nextKey) {
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
            <Progress
              value={(status.doneCount / total) * 100}
              aria-label={t("dashboard.setup.title")}
              className="h-1.5"
            />
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
