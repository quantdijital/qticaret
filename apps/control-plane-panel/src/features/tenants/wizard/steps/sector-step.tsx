import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { sectorPacksQuery } from "@/features/sector-packs/api"
import { packContents } from "@/features/sector-packs/words"
import { errorText } from "@/lib/errors"
import type { StepProps } from "../field"

/**
 * Step 5, the sector pack (adr/0061 F17.7, C12): every pack the control
 * plane offers as a card of one height, its name, its description and
 * what it brings; "Genel" first and chosen unless another is. The setup
 * applies it in the shop (`tenant:apply-pack`), adding only what the shop
 * does not have; the shop's page can apply it again later.
 */
export function SectorStep({ draft, change }: StepProps) {
  const { t } = useTranslation()
  const packs = useQuery(sectorPacksQuery())
  const list = packs.data?.sector_packs ?? []
  return (
    <SectionCard title={t("wizard.sector.title")} description={t("wizard.sector.text")}>
      {packs.isError ? (
        <ErrorState text={errorText(t, packs.error)} onRetry={() => void packs.refetch()} />
      ) : packs.isPending ? (
        <LoadingRows rows={2} />
      ) : (
        <RadioGroup
          aria-label={t("wizard.sector.title")}
          value={draft.sector_pack}
          onValueChange={(value) => {
            change((current) => ({ ...current, sector_pack: value }))
          }}
          className="grid items-stretch gap-3 md:grid-cols-2"
        >
          {list.map((pack) => (
            <label
              key={pack.code}
              htmlFor={`wizard-sector-${pack.code}`}
              className={cn(
                "flex h-full cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                draft.sector_pack === pack.code
                  ? "border-primary bg-primary/5"
                  : "hover:border-foreground/30"
              )}
            >
              <RadioGroupItem
                id={`wizard-sector-${pack.code}`}
                value={pack.code}
                className="mt-1"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{pack.name}</span>
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    {t("sectorPacks.version", { version: pack.version })}
                  </span>
                </span>
                <span className="text-[13px] leading-5 text-muted-foreground">
                  {pack.description}
                </span>
                <span className="text-[13px] leading-5">{packContents(t, pack)}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      )}
    </SectionCard>
  )
}
