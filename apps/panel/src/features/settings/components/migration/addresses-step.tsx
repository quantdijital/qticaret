import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { MigrationOverview } from "@/features/settings/api/migration-overview"
import { stepTitle } from "@/features/settings/components/migration/step-title"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const A = "settings.migration.afterCards"

/**
 * The first step after the move (F14.7): how many old addresses there are
 * and how many await the owner; the decisions themselves on their own
 * page (`/settings/migration/addresses`).
 */
export function AddressesStepCard({
  overview,
  className,
  step,
}: {
  overview: MigrationOverview | undefined
  className?: string
  step?: number
}) {
  const { t } = useTranslation()
  const addresses = overview?.addresses
  return (
    <SectionCard
      title={stepTitle(t, t(`${A}.addresses`), step)}
      description={t("settings.migration.addresses.description")}
      {...(className ? { className } : {})}
    >
      <div className="flex flex-1 flex-col gap-4">
        {!addresses ? (
          <Skeleton className="h-10 rounded-md" />
        ) : (
          <p className="text-sm">
            {addresses.total > 0
              ? t(`${A}.addressesSummary`, {
                  total: formatCount(addresses.total),
                  undecided: formatCount(addresses.undecided),
                })
              : t(`${A}.addressesNone`)}
          </p>
        )}
        <Button asChild variant="outline" className="mt-auto self-start">
          <Link to="/settings/migration/addresses">
            {t(`${A}.decide`)}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </SectionCard>
  )
}
