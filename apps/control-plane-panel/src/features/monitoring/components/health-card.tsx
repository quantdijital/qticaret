import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { formatDateTime, formatPercent, formatRelative } from "@qticaret/admin-ui/lib/format"
import type { HealthTarget, Probe, TargetHealth, UsageHealth } from "../api"
import { HEALTH_TONES, uptimeOf, wordOf } from "../rules"
import { probeErrorText } from "../words"

/** The last probes as a row of marks, oldest on the left; their tally for screen readers. */
function ProbeStrip({ history }: { history: Probe[] }) {
  const { t } = useTranslation()
  if (history.length === 0) {
    return null
  }
  const ok = history.filter((probe) => probe.ok).length
  const label = t("health.historyLabel", { count: history.length, ok })
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {t("health.history", { count: history.length })}
      </span>
      <div role="img" aria-label={label} className="flex h-5 items-stretch gap-0.5">
        {[...history].reverse().map((probe) => (
          <span
            key={probe.checked_at}
            title={`${formatDateTime(probe.checked_at)} · ${
              probe.ok
                ? t("health.latency", { value: probe.latency_ms ?? 0 })
                : probeErrorText(t, probe.error ?? "")
            }`}
            className={cn("w-1.5 rounded-sm", probe.ok ? "bg-success" : "bg-destructive")}
          />
        ))}
      </div>
    </div>
  )
}

function TargetBlock({ name, target }: { name: HealthTarget; target: TargetHealth }) {
  const { t } = useTranslation()
  const word = wordOf(target)
  const standing = target.standing
  const uptime = uptimeOf(target.day)
  const lines: string[] = []
  if (standing) {
    if (standing.state !== "healthy" && standing.error) {
      lines.push(
        `${probeErrorText(t, standing.error)} · ${t("health.failures", {
          count: standing.consecutive_failures,
        })}`
      )
    }
    lines.push(
      t("health.checkedAt", {
        when: `${formatRelative(standing.checked_at)} (${formatDateTime(standing.checked_at)})`,
      })
    )
    if (standing.state !== "healthy" && standing.last_ok_at) {
      lines.push(t("health.lastOk", { when: formatDateTime(standing.last_ok_at) }))
    }
    if (uptime !== null) {
      lines.push(t("health.uptime", { value: formatPercent(uptime) }))
    }
  } else {
    lines.push(t(word === "off" ? `health.offText.${name}` : "health.unknownText"))
  }
  return (
    <section
      aria-label={t(`health.targets.${name}`)}
      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{t(`health.targets.${name}`)}</span>
          <span className="text-xs text-muted-foreground">{t(`health.targetText.${name}`)}</span>
        </div>
        <span className="flex items-center gap-2">
          {standing?.state === "healthy" && standing.latency_ms !== null ? (
            <span className="text-sm tabular-nums text-muted-foreground">
              {t("health.latency", { value: standing.latency_ms })}
            </span>
          ) : null}
          <StatusBadge tone={HEALTH_TONES[word]}>{t(`health.state.${word}`)}</StatusBadge>
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ProbeStrip history={target.history} />
    </section>
  )
}

/**
 * The control plane's probes of the shop (adr/0061 §5.4, Ek C13): its
 * backend's `/health` and its storefront's home page, each with its state
 * in words (unhealthy after `unhealthy_after` failures in a row), its
 * answer time, the last probe's time, a day's share of answers and the
 * last probes as marks.
 */
export function HealthCard({ data }: { data: UsageHealth }) {
  const { t } = useTranslation()
  return (
    <SectionCard
      title={t("health.title")}
      description={t("health.text", { count: data.health.unhealthy_after })}
    >
      <div className="flex flex-col divide-y">
        <TargetBlock name="backend" target={data.health.backend} />
        <TargetBlock name="storefront" target={data.health.storefront} />
      </div>
    </SectionCard>
  )
}
