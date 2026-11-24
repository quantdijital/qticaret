import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { latestSynonymsQuery } from "@/features/seo/api/synonyms"
import { TermChips } from "@/features/seo/site-search/synonyms-table"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const C = "seo.siteSearchCard"
// The newest groups shown: the card stands under the redirects, level with the sitemap
const SHOWN = 2

/** Site search's synonym groups at a glance (adr/0056), with the way to the screen that keeps them. */
export function SiteSearchCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const latest = useQuery(latestSynonymsQuery(SHOWN))
  const count = latest.data?.count
  return (
    <SectionCard
      title={t(`${C}.title`)}
      description={
        count === undefined
          ? t(`${C}.hint`)
          : t(`${C}.hintCount`, { count, shown: formatCount(count) })
      }
      className={className}
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/settings/seo" search={{ part: "site-search" }}>
            {t(`${C}.open`)}
            <ArrowRight />
          </Link>
        </Button>
      }
    >
      {latest.isError ? (
        <ErrorState text={errorText(t, latest.error)} onRetry={() => void latest.refetch()} />
      ) : !latest.data ? (
        <Skeleton className="h-20" />
      ) : latest.data.synonyms.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${C}.empty`)}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {latest.data.synonyms.map((group) => (
            <li key={group.id} className="px-3 py-1.5">
              <TermChips terms={group.terms} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
