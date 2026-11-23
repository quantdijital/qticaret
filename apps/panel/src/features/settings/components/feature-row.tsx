import { Lock, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { FeatureState } from "@/features/settings/api/features"
import { useFeatureText } from "@/features/settings/feature-text"

/**
 * One flag on Settings > Features: name, one line and a switch. The full
 * description opens behind the (i); a plan flag stays visible with its
 * reason and a locked switch; a flag that needs another one says so while
 * that one is off (a warning, not a block).
 */
export function FeatureRow({
  feature,
  requires,
  busy,
  onToggle,
}: {
  feature: FeatureState
  /** The flag this one needs, when it is off. */
  requires?: { label: string } | undefined
  busy: boolean
  onToggle: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  const text = useFeatureText()(feature.key)
  const locked = feature.owner !== "tenant"
  const id = `feature-${feature.key}`
  const hintId = `${id}-hint`
  return (
    <li className="flex items-start justify-between gap-4 border-t px-5 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={id} className="text-sm font-medium">
            {text.label}
          </label>
          {text.description ? (
            <InfoTip name={text.label} hint={text.description} hintId={hintId} />
          ) : null}
          {locked ? (
            <Badge variant="secondary">
              <Lock aria-hidden="true" />
              {t("settings.features.lockedBadge")}
            </Badge>
          ) : null}
        </span>
        <span className="text-[13px] leading-5 text-muted-foreground">
          {locked ? `${text.summary} ${t("settings.features.locked")}` : text.summary}
        </span>
        {requires ? (
          <span className="flex items-start gap-1.5 text-[13px] leading-5 text-warning-text">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("settings.features.requires", { name: requires.label })}
          </span>
        ) : null}
        {text.description ? <HiddenHint id={hintId}>{text.description}</HiddenHint> : null}
      </div>
      <Switch
        id={id}
        checked={feature.enabled}
        disabled={locked || busy}
        aria-describedby={text.description ? hintId : undefined}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
    </li>
  )
}
