import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PeriodPicker } from "@qticaret/admin-ui/patterns/period-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCurrentUser } from "@/features/auth/api/me"
import { PERIODS } from "@/features/dashboard/period"
import type { PeriodKey } from "@/features/dashboard/period"
import { formatLongDate } from "@qticaret/admin-ui/lib/format"
import { useDocumentTitle } from "@qticaret/admin-ui/hooks/use-document-title"

interface DashboardHeaderProps {
  period: PeriodKey
  onPeriodChange: (period: PeriodKey) => void
}

/** Greeting, today's date, the period every number follows, and the one primary action. */
export function DashboardHeader({ period, onPeriodChange }: DashboardHeaderProps) {
  const { t } = useTranslation()
  const name = useCurrentUser()?.first_name?.trim()
  useDocumentTitle(t("dashboard.title"))
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
        <PeriodPicker
          periods={PERIODS}
          value={period}
          onChange={onPeriodChange}
          labelOf={(key) => t(`period.${key}`)}
        />
        <Button asChild>
          <Link to="/products/new">
            <Plus />
            {t("dashboard.addProduct")}
          </Link>
        </Button>
      </div>
    </header>
  )
}
