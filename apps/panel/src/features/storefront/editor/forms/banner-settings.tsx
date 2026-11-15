import { RotateCcw } from "lucide-react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { BANNER_DEFAULTS, BANNER_SETTINGS } from "@qticaret/types"
import type { BannerSetting, BannerStep } from "@qticaret/types"
import type { BannerSection } from "@/features/storefront/api/layout"
import { Hint } from "../shared/hint"
import { FIELD_IDS } from "./field-registry"

const B = "storefront.editor.banner"

const COLUMNS: Readonly<Record<number, string>> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  9: "grid-cols-3",
}

/** A step of the words' place drawn small: a 3 × 3 grid, the chosen cell filled. */
function PlaceSketch({ step }: { step: string }) {
  const at = BANNER_SETTINGS.text_position.indexOf(step as BannerStep<"text_position">)
  return (
    <span aria-hidden="true" className="grid size-5 grid-cols-3 gap-px rounded-sm border p-0.5">
      {BANNER_SETTINGS.text_position.map((cell, index) => (
        <span
          key={cell}
          className={cn("rounded-xs", index === at ? "bg-current" : "bg-muted-foreground/25")}
        />
      ))}
    </span>
  )
}

/**
 * One of the band's settings (adr/0049 Ek 2026-11-14 §3.3 E2): its
 * everyday Turkish name with the technical term small beside it
 * ("Perde gücü" overlay), its steps side by side (the words' place as a
 * small grid), and "Varsayılana dön" once it differs from the default.
 */
function BannerSettingField<S extends BannerSetting>({
  section,
  setting,
  onChange,
}: {
  section: BannerSection
  setting: S
  onChange: (step: BannerStep<S>) => void
}) {
  const { t } = useTranslation()
  const id = FIELD_IDS.banner(section.id, setting)
  const value = section[setting] as BannerStep<S>
  const fallback = BANNER_DEFAULTS[setting]
  const steps: readonly BannerStep<S>[] = BANNER_SETTINGS[setting]
  const place = setting === "text_position"
  const group = useRef<HTMLDivElement>(null)
  const hint = t(`${B}.${setting}.hint`, { defaultValue: "" })
  return (
    <div id={id} className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {t(`${B}.${setting}.label`)}{" "}
          <small className="text-[11px] font-normal text-muted-foreground">
            {t(`${B}.${setting}.term`)}
          </small>
        </span>
        {value !== fallback ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              onChange(fallback)
              group.current?.querySelector<HTMLElement>("[role=radio]")?.focus()
            }}
          >
            <RotateCcw />
            {t("storefront.editor.look.reset")}
          </Button>
        ) : null}
      </div>
      <ToggleGroup
        ref={group}
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        {...(hint ? { "aria-describedby": `${id}-hint` } : {})}
        value={value}
        onValueChange={(next) => {
          // Picking the chosen step again keeps it: a band always has one
          if (next !== "") onChange(next as BannerStep<S>)
        }}
        className={cn("grid w-full", COLUMNS[steps.length], place && "max-w-56")}
      >
        {steps.map((step) => (
          // A sketch has no words: the hint names it (its own state named again, past the hint's)
          <Hint key={step} label={place ? t(`${B}.${setting}.${step}`) : null} side="bottom">
            <ToggleGroupItem
              value={step}
              data-state={value === step ? "on" : "off"}
              aria-label={place ? t(`${B}.${setting}.${step}`) : undefined}
              className="h-auto min-w-0 gap-1 px-1.5 py-2 text-xs data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
            >
              {place ? (
                <PlaceSketch step={step} />
              ) : (
                <span className="truncate">{t(`${B}.${setting}.${step}`)}</span>
              )}
            </ToggleGroupItem>
          </Hint>
        ))}
      </ToggleGroup>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Some of the band's settings (its basics open in "Diziliş", the rarer
 * ones closed in "Diğer ayarlar": `banner-groups.ts`), each its own step
 * in the editor's history.
 */
export function BannerSettings({
  section,
  settings,
  onChange,
}: {
  section: BannerSection
  settings: readonly BannerSetting[]
  onChange: (section: BannerSection) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {settings.map((setting) => (
        <BannerSettingField
          key={setting}
          section={section}
          setting={setting}
          onChange={(step) => {
            onChange({ ...section, [setting]: step })
          }}
        />
      ))}
    </div>
  )
}
