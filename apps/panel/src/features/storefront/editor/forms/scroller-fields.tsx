import { useTranslation } from "react-i18next"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { SCROLLER_DEFAULTS, SCROLLER_SETTINGS } from "@qticaret/types"
import type { ScrollerSetting, ScrollerSettings } from "@qticaret/types"
import { Head, ResetButton } from "./marquee-controls"
import { scrollerOffers } from "./scroller-groups"

const S = "storefront.editor.scroller"

const COLUMNS: Readonly<Record<number, string>> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

/** The settings told as a switch: two steps, "off" and "on". */
const isSwitch = (setting: ScrollerSetting): boolean => {
  const steps: readonly string[] = SCROLLER_SETTINGS[setting]
  return steps.length === 2 && steps.includes("on")
}

/** A setting's name: its everyday Turkish word with the technical term small beside it. */
function Name({ id, setting }: { id: string; setting: ScrollerSetting }) {
  const { t } = useTranslation()
  return (
    <span id={`${id}-label`} className="text-sm font-medium">
      {t(`${S}.${setting}.label`)}{" "}
      <small className="text-[11px] font-normal text-muted-foreground">
        {t(`${S}.${setting}.term`)}
      </small>
    </span>
  )
}

/** The setting's short hint, when it has one. */
function Hint({ id, setting }: { id: string; setting: ScrollerSetting }) {
  const { t } = useTranslation()
  const hint = t(`${S}.${setting}.hint`, { defaultValue: "" })
  return hint ? (
    <p id={`${id}-hint`} className="text-xs text-muted-foreground">
      {hint}
    </p>
  ) : null
}

/** One setting: a switch for an on/off one, else its steps side by side with "Varsayılana dön". */
function ScrollerField({
  id,
  setting,
  value,
  onChange,
}: {
  id: string
  setting: ScrollerSetting
  value: string
  onChange: (step: string) => void
}) {
  const { t } = useTranslation()
  if (isSwitch(setting)) {
    return (
      <div id={id} className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${id}-input`}>
            <Name id={id} setting={setting} />
          </label>
          <Switch
            id={`${id}-input`}
            checked={value === "on"}
            onCheckedChange={(checked) => {
              onChange(checked ? "on" : "off")
            }}
          />
        </div>
        <Hint id={id} setting={setting} />
      </div>
    )
  }
  const steps: readonly string[] = SCROLLER_SETTINGS[setting]
  const fallback = SCROLLER_DEFAULTS[setting]
  return (
    <div id={id} className="flex flex-col gap-2">
      <Head>
        <Name id={id} setting={setting} />
        {value !== fallback ? (
          <ResetButton
            onReset={() => {
              onChange(fallback)
            }}
          />
        ) : null}
      </Head>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        value={value}
        onValueChange={(next) => {
          // Picking the chosen step again keeps it: a row always has one
          if (next !== "") onChange(next)
        }}
        className={cn("grid w-full", COLUMNS[steps.length])}
      >
        {steps.map((step) => (
          <ToggleGroupItem
            key={step}
            value={step}
            className="h-auto min-w-0 px-1.5 py-2 text-xs data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            <span className="truncate">{t(`${S}.${setting}.${step}`)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Hint id={id} setting={setting} />
    </div>
  )
}

/**
 * Some of the scroller kit's settings, each its own step in the editor's
 * history; one the row does not offer as it stands is left out (the
 * arrows' look with the arrows hidden, the speed while it does not turn).
 * Shared by every section that scrolls; `fieldId` names each element for
 * the settings search.
 */
export function ScrollerFields({
  value,
  settings,
  fieldId,
  onChange,
}: {
  value: ScrollerSettings
  settings: readonly ScrollerSetting[]
  fieldId: (setting: ScrollerSetting) => string
  onChange: (next: ScrollerSettings) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {settings
        .filter((setting) => scrollerOffers(value, setting))
        .map((setting) => (
          <ScrollerField
            key={setting}
            id={fieldId(setting)}
            setting={setting}
            value={value[setting]}
            onChange={(step) => {
              onChange({ ...value, [setting]: step })
            }}
          />
        ))}
    </div>
  )
}
