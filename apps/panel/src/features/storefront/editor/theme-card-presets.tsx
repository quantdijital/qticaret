import { useTranslation } from "react-i18next"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { CARD_PRESETS, CARD_PRESET_VALUES, cardPresetOf } from "./card-presets"
import type { CardPreset } from "./card-presets"

const C = "storefront.editor.theme.tourCard.presets"

type Card = ThemeSettings["product_card"]

/** A small drawing of each look: the photo, its pills, its words. */
function Sketch({ preset }: { preset: CardPreset }) {
  const pill = "absolute h-1.5 w-4 rounded-full bg-background/90"
  return (
    <span aria-hidden="true" className="flex w-14 shrink-0 flex-col gap-1">
      <span className="relative block h-10 rounded-sm bg-muted-foreground/30">
        {preset !== "classic" && <span className={`${pill} top-1 right-1`} />}
        {preset === "modern" && <span className={`${pill} bottom-1 left-1`} />}
        {preset === "glass" && (
          <span className="absolute inset-x-1 bottom-1 flex h-3.5 flex-col justify-center gap-0.5 rounded-sm bg-background/80 px-1">
            <span className="block h-0.5 w-6 rounded-full bg-foreground/60" />
            <span className="block h-0.5 w-4 rounded-full bg-foreground/40" />
          </span>
        )}
      </span>
      {preset !== "glass" && (
        <>
          <span className="block h-1 w-10 rounded-full bg-foreground/50" />
          <span className="block h-1 w-6 rounded-full bg-foreground/30" />
          {preset === "classic" && <span className="block h-1 w-8 rounded-full bg-foreground/20" />}
        </>
      )}
    </span>
  )
}

/**
 * "Hazır kart görünümü" (sahip 2026-11-26): three ready-made looks over the
 * card's settings. Picking one fills its settings in; the one the settings
 * match stands chosen, none when they match no look ("Özel").
 */
export function CardPresetPicker({
  card,
  onPick,
}: {
  card: Card
  onPick: (patch: Partial<Card>) => void
}) {
  const { t } = useTranslation()
  const current = cardPresetOf(card)
  return (
    <div className="flex flex-col gap-2">
      <p id="theme-card-preset-label" className="text-sm font-medium">
        {t(`${C}.title`)}
        {current === null && (
          <span className="ml-2 rounded-sm border px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {t(`${C}.custom`)}
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {current === null ? t(`${C}.customHint`) : t(`${C}.hint`)}
      </p>
      <RadioGroup
        aria-labelledby="theme-card-preset-label"
        value={current ?? ""}
        className="grid gap-2"
        onValueChange={(next) => {
          const preset = CARD_PRESETS.find((name) => name === next)
          if (preset) {
            onPick(CARD_PRESET_VALUES[preset])
          }
        }}
      >
        {CARD_PRESETS.map((preset) => (
          <label
            key={preset}
            className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary"
          >
            <RadioGroupItem value={preset} aria-label={t(`${C}.${preset}`)} />
            <Sketch preset={preset} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{t(`${C}.${preset}`)}</span>
              <span className="text-xs text-muted-foreground">{t(`${C}.${preset}Hint`)}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}
