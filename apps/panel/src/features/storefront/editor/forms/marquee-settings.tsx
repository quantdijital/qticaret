import { RotateCcw } from "lucide-react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { MARQUEE_DEFAULTS, MARQUEE_SETTINGS } from "@qticaret/types"
import type { MarqueeSetting, MarqueeStep } from "@qticaret/types"
import type { HeaderMarquee, MarqueeSection } from "@/features/storefront/api/layout"
import { FIELD_IDS } from "./field-registry"
import { MarqueeSketch } from "./marquee-sketches"

const M = "storefront.editor.marquee"

const COLUMNS: Readonly<Record<number, string>> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

type AnyMarquee = MarqueeSection | HeaderMarquee

/**
 * One of a scrolling strip's settings (adr/0049 Ek 2026-11-14 §4.1): its
 * everyday Turkish name with the technical term small beside it ("Hız"
 * speed), its steps side by side each drawn in small, and "Varsayılana
 * dön" once it differs from the strip's default.
 */
function MarqueeSettingField<S extends MarqueeSetting>({
  section,
  setting,
  onChange,
}: {
  section: AnyMarquee
  setting: S
  onChange: (step: MarqueeStep<S>) => void
}) {
  const { t } = useTranslation()
  const id = FIELD_IDS.marquee(section.id, setting)
  const value = section[setting] as MarqueeStep<S>
  const fallback = MARQUEE_DEFAULTS[setting]
  const steps: readonly MarqueeStep<S>[] = MARQUEE_SETTINGS[setting]
  const group = useRef<HTMLDivElement>(null)
  return (
    <div id={id} className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {t(`${M}.${setting}.label`)}{" "}
          <small className="text-[11px] font-normal text-muted-foreground">
            {t(`${M}.${setting}.term`)}
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
        value={value}
        onValueChange={(next) => {
          // Picking the chosen step again keeps it: a strip always has one
          if (next !== "") onChange(next as MarqueeStep<S>)
        }}
        className={cn("grid w-full", COLUMNS[steps.length])}
      >
        {steps.map((step) => (
          <ToggleGroupItem
            key={step}
            value={step}
            className="h-auto min-w-0 flex-col gap-1 px-1.5 py-2 text-xs data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            <MarqueeSketch setting={setting} step={step} />
            <span className="truncate">{t(`${M}.${setting}.${step}`)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {t(`${M}.${setting}.hint`, { defaultValue: "" }) ? (
        <p className="text-xs text-muted-foreground">{t(`${M}.${setting}.hint`)}</p>
      ) : null}
    </div>
  )
}

/** Some of a scrolling strip's settings, each its own step in the editor's history. */
export function MarqueeSettings<S extends AnyMarquee>({
  section,
  settings,
  onChange,
}: {
  section: S
  settings: readonly MarqueeSetting[]
  onChange: (section: S) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {settings.map((setting) => (
        <MarqueeSettingField
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
