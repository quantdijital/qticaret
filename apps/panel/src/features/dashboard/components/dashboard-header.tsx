import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PeriodPicker } from "@/components/patterns/period-picker"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/features/auth/api/me"
import { PERIODS } from "@/features/dashboard/period"
import type { PeriodKey } from "@/features/dashboard/period"
import { advancedPanelUrl } from "@/lib/advanced-panel"
import { formatLongDate } from "@/lib/format"

interface DashboardHeaderProps {
  period: PeriodKey
  onPeriodChange: (period: PeriodKey) => void
}

/** Greeting, today's date, the period every number follows, and the one primary action. */
export function DashboardHeader({ period, onPeriodChange }: DashboardHeaderProps) {
  const { t } = useTranslation()
  const name = useCurrentUser()?.first_name?.trim()
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-8 font-semibold tracking-[-0.015em]">
          {name ? t("dashboard.greeting", { name }) : t("dashboard.greetingNoName")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.subtitle", { date: formatLongDate(new Date()) })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker periods={PERIODS} value={period} onChange={onPeriodChange} />
        <Button asChild>
          <a href={advancedPanelUrl("/products/create")} target="_blank" rel="noreferrer">
            <Plus />
            {t("dashboard.addProduct")}
          </a>
        </Button>
      </div>
    </header>
  )
}
