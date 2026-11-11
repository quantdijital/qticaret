import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { useMe } from "@/features/auth/api"
import { plansQuery } from "@/features/packages/api"
import { limitText, priceText } from "@/features/packages/format"
import { canManagePackages } from "@/features/tenants/permissions"
import { errorText } from "@/lib/errors"
import type { StepProps } from "../field"

/**
 * Step 3, the package (required: the setup refuses a shop without one,
 * Ek C10, since its plan document names it). Each package on sale as a
 * card of one height: its price and period, its trial and grace days and
 * its six limits.
 */
export function PackageStep({ draft, change, problems }: StepProps) {
  const { t } = useTranslation()
  const me = useMe()
  const plans = useQuery(plansQuery())
  const offered = (plans.data?.plans ?? []).filter((plan) => plan.archived_at === null)
  const problem = problems["package_id"]
  return (
    <SectionCard title={t("wizard.package.title")} description={t("wizard.package.text")}>
      {plans.isError ? (
        <ErrorState text={errorText(t, plans.error)} onRetry={() => void plans.refetch()} />
      ) : plans.isPending ? (
        <LoadingRows rows={3} />
      ) : offered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("wizard.package.none")}{" "}
          {canManagePackages(me?.role) ? (
            <Link to="/packages" className="font-medium text-foreground underline">
              {t("wizard.package.toPackages")}
            </Link>
          ) : null}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <RadioGroup
            aria-label={t("wizard.package.title")}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "wizard-package-note" : undefined}
            value={draft.package_id}
            onValueChange={(value) => {
              change((current) => ({ ...current, package_id: value }))
            }}
            className="grid items-stretch gap-3 md:grid-cols-2"
          >
            {offered.map((plan) => {
              const chosen = draft.package_id === plan.id
              return (
                <label
                  key={plan.id}
                  htmlFor={`wizard-package-${plan.id}`}
                  className={cn(
                    "flex h-full cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                    chosen ? "border-primary bg-primary/5" : "hover:border-foreground/30"
                  )}
                >
                  <RadioGroupItem
                    id={`wizard-package-${plan.id}`}
                    value={plan.id}
                    className="mt-1"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold">{plan.name}</span>
                      <span className="text-sm font-medium tabular-nums">{priceText(t, plan)}</span>
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {t("wizard.package.days", {
                        trial: plan.trial_days,
                        grace: plan.grace_days,
                      })}
                    </span>
                    <span className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                      {LIMIT_KEYS.map((key) => (
                        <span key={key} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{t(`limits.keys.${key}`)}</span>
                          <span className="tabular-nums">
                            {limitText(t, key, plan.limits[key])}
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                </label>
              )
            })}
          </RadioGroup>
          {problem ? (
            <p id="wizard-package-note" className="text-[13px] leading-5 text-destructive-text">
              {t(problem)}
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}
