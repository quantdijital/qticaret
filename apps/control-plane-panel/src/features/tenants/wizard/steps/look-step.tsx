import { useQuery } from "@tanstack/react-query"
import { LayoutTemplate } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import {
  chosenPreset,
  packName,
  presetPreviewPath,
  presetsOf,
  sectorPacksQuery,
} from "@/features/sector-packs/api"
import type { PresetSummary } from "@/features/sector-packs/api"
import { errorText } from "@/lib/errors"
import type { StepProps } from "../field"

/** The look's picture, or a plain frame of the same size when it has none or it cannot be read. */
function Preview({ pack, look }: { pack: string; look: PresetSummary }) {
  const [broken, setBroken] = useState(false)
  if (!look.preview || broken) {
    return (
      <span className="flex aspect-[16/10] w-full items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <LayoutTemplate aria-hidden="true" className="size-6" />
      </span>
    )
  }
  return (
    <img
      src={presetPreviewPath(pack, look.code)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        setBroken(true)
      }}
      className="aspect-[16/10] w-full rounded-md border bg-muted object-cover object-top"
    />
  )
}

/**
 * Step 6, the ready-made look (adr/0063 §7, task 2.7): the chosen sector
 * pack's looks as cards of one height, each with its picture, name and
 * description; the pack's first is chosen unless another is. The setup
 * writes it into the shop's design and, the shop being new, publishes it,
 * so the storefront opens with it; the owner fine-tunes it in the shop's
 * panel. A pack with no looks says so: the shop opens with the plain one.
 */
export function LookStep({ draft, change }: StepProps) {
  const { t } = useTranslation()
  const packs = useQuery(sectorPacksQuery())
  const list = packs.data?.sector_packs
  const looks = presetsOf(list, draft.sector_pack)
  const chosen = chosenPreset(list, draft.sector_pack, draft.preset)
  return (
    <SectionCard
      title={t("wizard.look.title")}
      description={t("wizard.look.text", { pack: packName(list, draft.sector_pack) })}
    >
      {packs.isError ? (
        <ErrorState text={errorText(t, packs.error)} onRetry={() => void packs.refetch()} />
      ) : packs.isPending ? (
        <LoadingRows rows={2} />
      ) : looks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("wizard.look.none")}</p>
      ) : (
        <RadioGroup
          aria-label={t("wizard.look.title")}
          value={chosen?.code ?? ""}
          onValueChange={(value) => {
            change((current) => ({ ...current, preset: value }))
          }}
          className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {looks.map((look, index) => (
            <label
              key={look.code}
              htmlFor={`wizard-look-${look.code}`}
              className={cn(
                "flex h-full cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors",
                chosen?.code === look.code
                  ? "border-primary bg-primary/5"
                  : "hover:border-foreground/30"
              )}
            >
              <Preview pack={draft.sector_pack} look={look} />
              <span className="flex items-start gap-3">
                <RadioGroupItem
                  id={`wizard-look-${look.code}`}
                  value={look.code}
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold">{look.name}</span>
                    {index === 0 ? (
                      <span className="text-[13px] text-muted-foreground">
                        {t("wizard.look.default")}
                      </span>
                    ) : null}
                  </span>
                  <span className="line-clamp-4 text-[13px] leading-5 text-muted-foreground">
                    {look.description}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      )}
    </SectionCard>
  )
}
