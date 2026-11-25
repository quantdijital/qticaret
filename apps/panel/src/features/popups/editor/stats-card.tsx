import { useTranslation } from "react-i18next"
import { Sparkline } from "@qticaret/admin-ui/charts/sparkline"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatCard } from "@qticaret/admin-ui/patterns/stat-card"
import { formatCount, formatPercent } from "@qticaret/admin-ui/lib/format"
import type { PopupDetail } from "@/features/popups/api/types"
import { dailyImpressions } from "@/features/popups/stats"

const S = "popups.stats"

/**
 * Its counts all time, and the last 30 days' impressions as a line (adr/0080
 * §7); two by two in the detail's right column, four across when the
 * columns stack.
 */
export function StatsCard({ popup }: { popup: PopupDetail }) {
  const { t } = useTranslation()
  const { counts } = popup
  const rate = counts.impressions > 0 ? formatPercent(counts.clicks / counts.impressions) : "—"
  const last = dailyImpressions(popup.daily)
  const tiles = [
    { key: "impressions", value: formatCount(counts.impressions) },
    {
      key: "clicks",
      value: formatCount(counts.clicks),
      hint: t(`${S}.clickRate`, { rate }),
    },
    { key: "closes", value: formatCount(counts.closes) },
    popup.type === "newsletter"
      ? { key: "signups", value: formatCount(counts.signups) }
      : { key: "last30", value: formatCount(last.reduce((sum, each) => sum + each, 0)) },
  ]
  return (
    <SectionCard title={t(`${S}.title`)}>
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
          {tiles.map((tile) => (
            <StatCard
              key={tile.key}
              label={t(tile.key === "last30" ? `${S}.last30` : `popups.counts.${tile.key}`)}
              value={tile.value}
              {...(tile.hint ? { hint: tile.hint } : {})}
            />
          ))}
        </dl>
        {last.some((value) => value > 0) ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t(`${S}.daily`)}</span>
            <Sparkline values={last} className="h-14" />
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}
