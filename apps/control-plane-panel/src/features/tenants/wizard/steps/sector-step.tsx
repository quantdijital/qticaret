import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { StepProps } from "../field"

/**
 * Step 5, the sector pack (adr/0061 §8 F17.7): "Genel" today; the
 * sector-specific packs come with C12 and are shown as not offered yet.
 * The choice is kept on the shop's record; the setup applies it once
 * packs exist.
 */
export function SectorStep({ draft, change }: StepProps) {
  const { t } = useTranslation()
  const option = (value: string, enabled: boolean) => (
    <label
      htmlFor={`wizard-sector-${value}`}
      className={cn(
        "flex h-full gap-3 rounded-lg border p-4",
        enabled ? "cursor-pointer" : "cursor-not-allowed bg-muted/40",
        draft.sector_pack === value && "border-primary bg-primary/5"
      )}
    >
      <RadioGroupItem
        id={`wizard-sector-${value}`}
        value={value}
        disabled={!enabled}
        className="mt-1"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {t(`wizard.sector.packs.${value}.name`)}
          {enabled ? null : <StatusBadge tone="neutral">{t("wizard.sector.soon")}</StatusBadge>}
        </span>
        <span className="text-[13px] leading-5 text-muted-foreground">
          {t(`wizard.sector.packs.${value}.text`)}
        </span>
      </span>
    </label>
  )
  return (
    <SectionCard title={t("wizard.sector.title")} description={t("wizard.sector.text")}>
      <RadioGroup
        aria-label={t("wizard.sector.title")}
        value={draft.sector_pack}
        onValueChange={() => {
          change((current) => ({ ...current, sector_pack: "general" }))
        }}
        className="grid items-stretch gap-3 md:grid-cols-2"
      >
        {option("general", true)}
        {option("sector", false)}
      </RadioGroup>
    </SectionCard>
  )
}
