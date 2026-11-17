import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { MARQUEE_DEFAULTS, MARQUEE_SETTINGS } from "@qticaret/types"
import type { MarqueeSetting, MarqueeStep } from "@qticaret/types"
import type { HeaderMarquee, MarqueeSection } from "@/features/storefront/api/layout"
import { FIELD_IDS, isSwitch, marqueeOffers } from "./field-registry"
import {
  Head,
  ResetButton,
  SettingHint,
  SettingName,
  SpeedField,
  SwitchField,
} from "./marquee-controls"
import { MarqueeSketch } from "./marquee-sketches"

const M = "storefront.editor.marquee"

const COLUMNS: Readonly<Record<number, string>> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

type AnyMarquee = MarqueeSection | HeaderMarquee

/**
 * One of a scrolling strip's settings with its steps side by side, each
 * drawn in small, and "Varsayılana dön" once it differs from the strip's
 * default.
 */
function StepsField<S extends MarqueeSetting>({
  id,
  setting,
  value,
  onChange,
}: {
  id: string
  setting: S
  value: MarqueeStep<S>
  onChange: (step: MarqueeStep<S>) => void
}) {
  const { t } = useTranslation()
  const fallback = MARQUEE_DEFAULTS[setting]
  const steps: readonly MarqueeStep<S>[] = MARQUEE_SETTINGS[setting]
  const group = useRef<HTMLDivElement>(null)
  return (
    <div id={id} className="flex flex-col gap-2">
      <Head>
        <SettingName id={id} setting={setting} />
        {value !== fallback ? (
          <ResetButton
            onReset={() => {
              onChange(fallback)
              group.current?.querySelector<HTMLElement>("[role=radio]")?.focus()
            }}
          />
        ) : null}
      </Head>
      <ToggleGroup
        ref={group}
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        aria-describedby={
          t(`${M}.${setting}.hint`, { defaultValue: "" }) ? `${id}-hint` : undefined
        }
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
      <SettingHint id={id} setting={setting} />
    </div>
  )
}

/**
 * One setting (adr/0049 Ek 2026-11-14 §4.1, Ek 2026-11-15) as fits it:
 * the speed a row of five stops, an on/off one a switch, the others their
 * steps side by side; each named in everyday Turkish with the technical
 * term small beside it ("Hız" speed).
 */
function MarqueeSettingField({
  section,
  setting,
  onChange,
}: {
  section: AnyMarquee
  setting: MarqueeSetting
  onChange: (step: string) => void
}) {
  const id = FIELD_IDS.marquee(section.id, setting)
  if (setting === "speed") {
    return (
      <SpeedField
        id={id}
        value={section.speed}
        fallback={MARQUEE_DEFAULTS.speed}
        onChange={onChange}
      />
    )
  }
  if (isSwitch(setting)) {
    return <SwitchField id={id} setting={setting} value={section[setting]} onChange={onChange} />
  }
  return <StepsField id={id} setting={setting} value={section[setting]} onChange={onChange} />
}

/**
 * Some of a scrolling strip's settings, each its own step in the editor's
 * history; one the strip does not offer as it stands (the outline below
 * the large size) is left out.
 */
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
      {settings
        .filter((setting) => marqueeOffers(section, setting))
        .map((setting) => (
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
