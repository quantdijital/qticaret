import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { insightsQuery, vitalGrade } from "@/features/seo/api/insights"
import type { VitalKey } from "@/features/seo/api/insights"

const V = "seo.vitals"
const KEYS: readonly VitalKey[] = ["lcp_ms", "inp_ms", "cls"]
const TONE = { good: "success", improve: "warning", poor: "danger" } as const

const shown = (key: VitalKey, value: number): string =>
  key === "cls"
    ? value.toFixed(2)
    : key === "lcp_ms"
      ? `${(value / 1000).toFixed(1)} sn`
      : `${String(value)} ms`

/**
 * The SEO page: the shop's Core Web Vitals from Chrome's users (CrUX,
 * F10.11), p75 of the last 28 days, on phones and desktops, each graded
 * against Google's lines.
 */
export function WebVitalsCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(insightsQuery())
  const vitals = query.data?.insights.vitals
  return (
    <SectionCard title={t(`${V}.title`)} description={t(`${V}.hint`)} className={className}>
      {!vitals ? (
        <Skeleton className="h-40" />
      ) : vitals.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${V}.empty`)}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {(["PHONE", "DESKTOP"] as const).map((formFactor) => {
            const row = vitals.find((each) => each.form_factor === formFactor)
            return (
              <div key={formFactor} className="flex flex-col gap-1.5">
                <h3 className="text-sm font-medium">{t(`${V}.formFactors.${formFactor}`)}</h3>
                {!row?.has_data ? (
                  <p className="text-[13px] text-muted-foreground">{t(`${V}.noData`)}</p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2">
                    {KEYS.map((key) => {
                      const value = row[key]
                      return (
                        <li key={key} className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">
                            {t(`${V}.metrics.${key}`)}
                          </span>
                          {value === null ? (
                            <span className="text-[13px] text-muted-foreground">—</span>
                          ) : (
                            <StatusBadge tone={TONE[vitalGrade(key, value)]}>
                              {shown(key, value)}
                            </StatusBadge>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
