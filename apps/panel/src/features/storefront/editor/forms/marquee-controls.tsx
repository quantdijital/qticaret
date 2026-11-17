import { RotateCcw } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { MARQUEE_SETTINGS } from "@qticaret/types"
import type { MarqueeSetting, MarqueeStep } from "@qticaret/types"
import { useOffDefault } from "../group-mark"
import { HintedName } from "./field-hint"

const M = "storefront.editor.marquee"

/**
 * A setting's name: its everyday Turkish word with the technical term
 * small beside it, its short hint behind an (i) when it has one; the
 * label of the control `htmlFor` names (a switch), else the span its
 * group is labelled by.
 */
export function SettingName({
  id,
  setting,
  htmlFor,
}: {
  id: string
  setting: MarqueeSetting
  htmlFor?: string
}) {
  const { t } = useTranslation()
  const label = t(`${M}.${setting}.label`)
  const name = (
    <span id={`${id}-label`} className="text-sm font-medium">
      {label}{" "}
      <small className="text-[11px] font-normal text-muted-foreground">
        {t(`${M}.${setting}.term`)}
      </small>
    </span>
  )
  return (
    <HintedName
      name={label}
      hint={t(`${M}.${setting}.hint`, { defaultValue: "" })}
      hintId={`${id}-hint`}
    >
      {htmlFor ? <label htmlFor={htmlFor}>{name}</label> : name}
    </HintedName>
  )
}

/** The setting's short hint, when it has one: hidden, the (i) beside its name shows it. */
export function SettingHint({ id, setting }: { id: string; setting: MarqueeSetting }) {
  const { t } = useTranslation()
  const hint = t(`${M}.${setting}.hint`, { defaultValue: "" })
  return hint ? <HiddenHint id={`${id}-hint`}>{hint}</HiddenHint> : null
}

/** "Varsayılana dön", once the setting differs from its default: it counts on its group's title. */
export function ResetButton({ onReset }: { onReset: () => void }) {
  useOffDefault()
  const { t } = useTranslation()
  return (
    <Button type="button" variant="ghost" size="xs" onClick={onReset}>
      <RotateCcw />
      {t("storefront.editor.look.reset")}
    </Button>
  )
}

/** An on/off setting as a switch beside its name and hint. */
export function SwitchField({
  id,
  setting,
  value,
  onChange,
}: {
  id: string
  setting: MarqueeSetting
  value: string
  onChange: (step: "on" | "off") => void
}) {
  const { t } = useTranslation()
  return (
    <div id={id} className="flex items-start justify-between gap-4">
      <SettingName id={id} setting={setting} htmlFor={`${id}-input`} />
      <SettingHint id={id} setting={setting} />
      <Switch
        id={`${id}-input`}
        aria-describedby={
          t(`${M}.${setting}.hint`, { defaultValue: "" }) ? `${id}-hint` : undefined
        }
        checked={value === "on"}
        onCheckedChange={(checked) => {
          onChange(checked ? "on" : "off")
        }}
      />
    </div>
  )
}

/**
 * The speed as one row of five stops, slowest to fastest (a native range,
 * so arrows and Home/End move it); each stop's name below it and read out
 * as the value.
 */
export function SpeedField({
  id,
  value,
  fallback,
  onChange,
}: {
  id: string
  value: MarqueeStep<"speed">
  fallback: MarqueeStep<"speed">
  onChange: (step: MarqueeStep<"speed">) => void
}) {
  const { t } = useTranslation()
  const steps = MARQUEE_SETTINGS.speed
  const at = Math.max(0, steps.indexOf(value))
  return (
    <div id={id} className="flex flex-col gap-2">
      <Head>
        <SettingName id={id} setting="speed" />
        {value !== fallback ? (
          <ResetButton
            onReset={() => {
              onChange(fallback)
            }}
          />
        ) : null}
      </Head>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={at}
        aria-labelledby={`${id}-label`}
        aria-valuetext={t(`${M}.speed.${value}`)}
        className="h-6 w-full cursor-pointer accent-primary"
        onChange={(event) => {
          const next = steps[Number(event.target.value)]
          if (next) onChange(next)
        }}
      />
      <div aria-hidden="true" className="grid grid-cols-5 text-[11px] text-muted-foreground">
        {steps.map((step, index) => (
          <span
            key={step}
            className={
              index === 0 ? "text-left" : index === steps.length - 1 ? "text-right" : "text-center"
            }
            data-active={step === value ? "" : undefined}
          >
            <span className={step === value ? "font-medium text-foreground" : undefined}>
              {t(`${M}.speed.${step}`)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** A field's head row: its name, and on the right what resets it. */
export function Head({ children }: { children: ReactNode }) {
  return <div className="flex min-h-7 items-center justify-between gap-2">{children}</div>
}
