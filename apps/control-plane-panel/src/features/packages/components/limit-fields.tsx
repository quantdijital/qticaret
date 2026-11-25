import { useTranslation } from "react-i18next"
import { LIMIT_KEYS, isGrantLimit } from "@qticaret/types/control-plane"
import type { LimitKey } from "@qticaret/types/control-plane"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Label } from "@qticaret/admin-ui/ui/label"
import type { LimitDraft, LimitDrafts } from "./limit-drafts"

/**
 * Every registry limit of a package, one row each: a whole number (or
 * megabytes) or "Sınırsız". Orders are never blocked, only warned about
 * (adr/0061 §5.3); the row says so. A grant (adr/0085 K5) is a number,
 * never "Sınırsız".
 */
export function LimitFields({
  drafts,
  disabled,
  onChange,
}: {
  drafts: LimitDrafts
  disabled: boolean
  onChange: (key: LimitKey, draft: LimitDraft) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col divide-y">
      {LIMIT_KEYS.map((key) => {
        const draft = drafts[key]
        return (
          <div
            key={key}
            className="grid gap-3 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center"
          >
            <Label
              htmlFor={`limit-${key}`}
              className="flex flex-col items-start gap-0.5 font-normal"
            >
              <span className="text-sm font-medium">{t(`limits.keys.${key}`)}</span>
              {key === "orders_per_month" ? (
                <span className="text-[13px] text-muted-foreground">{t("limits.warnOnly")}</span>
              ) : null}
              {isGrantLimit(key) ? (
                <span className="text-[13px] text-muted-foreground">{t("limits.grantHint")}</span>
              ) : null}
            </Label>
            <NumberField
              id={`limit-${key}`}
              min={0}
              {...(key === "storage_mb" ? { suffix: "MB" } : {})}
              disabled={disabled || draft.unlimited}
              value={draft.unlimited ? "" : draft.text}
              onChange={(event) => {
                onChange(key, { ...draft, text: event.target.value })
              }}
            />
            {/* A grant is a number of credits, never unlimited (adr/0085 K5) */}
            {isGrantLimit(key) ? (
              <div aria-hidden="true" />
            ) : (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`limit-${key}-unlimited`}
                  disabled={disabled}
                  checked={draft.unlimited}
                  onCheckedChange={(checked) => {
                    onChange(key, { ...draft, unlimited: checked === true })
                  }}
                />
                <Label htmlFor={`limit-${key}-unlimited`} className="font-normal">
                  {t("limits.unlimited")}
                </Label>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
