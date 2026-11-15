import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { isHexColor } from "@/features/settings/storefront"
import { BACKGROUNDS } from "@/features/storefront/api/theme"
import { STOREFRONT_BACKGROUNDS } from "@/theme/storefront"
import type { StorefrontBackground } from "@/theme/storefront"

const C = "storefront.editor.theme"

interface ColorInputProps {
  id: string
  label: string
  hint?: string | undefined
  value: string
  onChange: (value: string) => void
  /** What the storefront paints while the field is empty; the picker shows it and starts there. */
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
          className="min-w-40 flex-1 font-mono"
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

/** The page colour: a swatch per tone, each named, the storefront's own values. */
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
      {/* Side by side once each gets 160 px; one under another below that */}
      <RadioGroup
        aria-labelledby="theme-background-label"
        aria-describedby="theme-background-hint"
        value={value}
        className="grid gap-2 @min-[21rem]:grid-cols-2"
        onValueChange={(next) => {
          onChange(next as StorefrontBackground)
        }}
      >
        {BACKGROUNDS.map((option) => (
          <label
            key={option}
            className="flex h-[var(--control-height)] cursor-pointer items-center gap-3 rounded-md border px-3 text-sm has-[[data-state=checked]]:border-primary"
          >
            <RadioGroupItem value={option} aria-label={t(`${C}.backgrounds.${option}`)} />
            <span className="min-w-0 flex-1 truncate">{t(`${C}.backgrounds.${option}`)}</span>
            <span
              aria-hidden="true"
              className="size-5 shrink-0 rounded-sm border"
              style={{ backgroundColor: STOREFRONT_BACKGROUNDS[option] }}
            />
          </label>
        ))}
      </RadioGroup>
      <p id="theme-background-hint" className="text-xs text-muted-foreground">
        {t(`${C}.backgroundHint`)}
      </p>
    </div>
  )
}

interface ChoiceSelectProps<T extends string> {
  id: string
  label: ReactNode
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  /** How an option reads: its name, and what else helps choose it. */
  render: (option: T) => ReactNode
  /** What the choice changes on the storefront, and what to know about the chosen one. */
  hint?: string | undefined
  /** Options shown but not offered (not drawn by the theme yet). */
  unavailable?: ReadonlySet<T> | undefined
}

/** One choice from the server's fixed list. */
export function ChoiceSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  render,
  hint,
  unavailable,
}: ChoiceSelectProps<T>) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
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
            <SelectItem key={option} value={option} disabled={unavailable?.has(option) ?? false}>
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
