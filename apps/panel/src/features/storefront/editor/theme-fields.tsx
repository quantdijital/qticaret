import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { isHexColor } from "@/features/settings/storefront"
import { BACKGROUNDS } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { cn } from "@/lib/utils"
import { STOREFRONT_BACKGROUNDS, storefrontTextOn } from "@/theme/storefront"
import type { StorefrontBackground } from "@/theme/storefront"

const C = "storefront.editor.theme"

interface ColorInputProps {
  id: string
  label: string
  hint?: string | undefined
  value: string
  onChange: (value: string) => void
  /** What the storefront paints while the field is empty; the picker starts there. */
  fallback: string
  error?: string | undefined
}

/** A colour: the browser's picker, its `#rrggbb` code, and back to the theme's own. */
export function ColorInput({ id, label, hint, value, onChange, fallback, error }: ColorInputProps) {
  const { t } = useTranslation()
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t(`${C}.pick`, { name: label })}
          value={isHexColor(value) ? value : fallback}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          placeholder={t(`${C}.themeOwn`)}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          className="w-32 font-mono"
          onChange={(event) => {
            onChange(event.target.value.trim().toLowerCase())
          }}
        />
        {value === "" ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              onChange("")
            }}
          >
            {t(`${C}.clear`)}
          </Button>
        )}
      </div>
    </Field>
  )
}

/** The page colour: three swatches, each named, the storefront's own values. */
export function BackgroundField({
  value,
  onChange,
}: {
  value: StorefrontBackground
  onChange: (value: StorefrontBackground) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <span id="theme-background-label" className="text-sm font-medium">
        {t(`${C}.background`)}
      </span>
      <RadioGroup
        aria-labelledby="theme-background-label"
        value={value}
        className="grid grid-cols-3 gap-2"
        onValueChange={(next) => {
          onChange(next as StorefrontBackground)
        }}
      >
        {BACKGROUNDS.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer flex-col gap-2 rounded-md border p-2 text-[13px] has-[[data-state=checked]]:border-primary"
          >
            <span
              aria-hidden="true"
              className="h-6 w-full rounded-sm border"
              style={{ backgroundColor: STOREFRONT_BACKGROUNDS[option] }}
            />
            <span className="flex min-w-0 items-center gap-2">
              <RadioGroupItem value={option} aria-label={t(`${C}.backgrounds.${option}`)} />
              <span className="truncate">{t(`${C}.backgrounds.${option}`)}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}

interface ChoiceSelectProps<T extends string> {
  id: string
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  /** How an option reads: its name, and what else helps choose it. */
  render: (option: T) => ReactNode
}

/** One choice from the server's fixed list. */
export function ChoiceSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  render,
}: ChoiceSelectProps<T>) {
  return (
    <Field label={label} htmlFor={id}>
      <Select
        value={value}
        onValueChange={(next) => {
          onChange(next as T)
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {render(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/** A yes-or-no choice with what it does. */
export function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="flex flex-col gap-0.5 text-sm">
        {label}
        <span className="text-xs text-muted-foreground">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

const BUTTON_CORNERS: Record<ThemeSettings["buttons"], string> = {
  pill: "rounded-full",
  rounded: "rounded-md",
  square: "rounded-none",
}

/** The announcement bar and a button as the storefront paints them with these choices. */
export function ThemeSample({
  primary,
  accent,
  background,
  buttons,
  announcement,
}: {
  primary: string
  accent: string | null
  background: StorefrontBackground
  buttons: ThemeSettings["buttons"]
  announcement: string
}) {
  const { t } = useTranslation()
  const paint = { backgroundColor: primary, color: storefrontTextOn(primary) }
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {t(`${C}.sample`)}
      </figcaption>
      <div
        className="flex flex-col overflow-hidden rounded-md border"
        style={{ backgroundColor: STOREFRONT_BACKGROUNDS[background] }}
      >
        <p style={paint} className="truncate px-4 py-2 text-center text-xs">
          {announcement}
        </p>
        <div className="flex items-center gap-3 p-3">
          <span
            style={paint}
            className={cn(
              "inline-flex h-9 items-center px-4 text-sm font-medium",
              BUTTON_CORNERS[buttons]
            )}
          >
            {t(`${C}.button`)}
          </span>
          {accent ? (
            <span
              style={{ backgroundColor: accent, color: storefrontTextOn(accent) }}
              className="rounded-full px-2 py-0.5 text-xs font-medium"
            >
              {t(`${C}.badge`)}
            </span>
          ) : null}
        </div>
      </div>
    </figure>
  )
}
