import { ArrowUpRight, CircleDashed } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { NavItem } from "@/components/layout/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { advancedPanelUrl } from "@/lib/advanced-panel"
import { PageHeader } from "./page-header"
import { SectionCard } from "./section-card"

/**
 * A section whose panel screen is still being built (adr/0022, docs/03 P
 * hattı): what it will hold, and the door to the same job in the advanced
 * panel until then. Replaced screen by screen.
 */
export function UpcomingPage({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  const features = t(`upcoming.features.${item.key}`, { returnObjects: true }) as string[]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`nav.${item.key}`)}
        action={
          <Button asChild>
            <a href={advancedPanelUrl(item.advanced)} target="_blank" rel="noreferrer">
              <ArrowUpRight />
              {t("upcoming.open")}
            </a>
          </Button>
        }
      />
      <SectionCard
        title={t("upcoming.planned")}
        description={t("upcoming.description")}
        action={<Badge variant="secondary">{t("upcoming.badge")}</Badge>}
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-3 rounded-md border bg-background px-4 py-3 text-sm"
            >
              <CircleDashed
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              {feature}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
