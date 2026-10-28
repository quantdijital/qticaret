import { Plus, X } from "lucide-react"
import { useState } from "react"
import type { KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { WizardValues } from "../schema"

type Option = WizardValues["options"][number]

const MAX_OPTIONS = 3

function ValueChips({
  option,
  onChange,
}: {
  option: Option
  onChange: (values: string[]) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const add = () => {
    const values = text
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value && !option.values.includes(value))
    if (values.length) {
      onChange([...option.values, ...values])
    }
    setText("")
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      add()
    } else if (event.key === "Backspace" && text === "" && option.values.length) {
      onChange(option.values.slice(0, -1))
    }
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
      {option.values.map((value) => (
        <span
          key={value}
          className="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[13px] text-accent-foreground"
        >
          {value}
          <button
            type="button"
            aria-label={t("products.wizard.options.removeValue", { value })}
            onClick={() => {
              onChange(option.values.filter((item) => item !== value))
            }}
            className="rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(event) => {
          setText(event.target.value)
        }}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={option.values.length ? "" : t("products.wizard.options.valuesPlaceholder")}
        aria-label={t("products.wizard.options.values", { option: option.title })}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

interface OptionsEditorProps {
  options: Option[]
  onChange: (options: Option[]) => void
}

/** Up to three options (size, colour…) and their values, typed as chips. */
export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const { t } = useTranslation()
  const used = new Set(options.map((option) => option.title))
  // Sector-neutral starting points (docs/06 ilke 9)
  const suggestions = t("products.wizard.options.suggestions", { returnObjects: true }) as string[]
  const update = (index: number, next: Option) => {
    onChange(options.map((option, at) => (at === index ? next : option)))
  }
  return (
    <div className="flex flex-col gap-3">
      {options.map((option, index) => (
        <div
          key={index}
          className="grid gap-2 rounded-lg border bg-background/60 p-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-start"
        >
          <Input
            value={option.title}
            aria-label={t("products.wizard.options.name")}
            placeholder={t("products.wizard.options.namePlaceholder")}
            onChange={(event) => {
              update(index, { ...option, title: event.target.value })
            }}
          />
          <ValueChips
            option={option}
            onChange={(values) => {
              update(index, { ...option, values })
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("products.wizard.options.remove")}
            onClick={() => {
              onChange(options.filter((_, at) => at !== index))
            }}
          >
            <X />
          </Button>
        </div>
      ))}
      {options.length < MAX_OPTIONS ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange([...options, { title: "", values: [] }])
            }}
          >
            <Plus />
            {t("products.wizard.options.add")}
          </Button>
          {suggestions
            .filter((title) => !used.has(title))
            .map((title) => (
              <button
                key={title}
                type="button"
                onClick={() => {
                  onChange([...options, { title, values: [] }])
                }}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:border-input hover:text-foreground"
              >
                + {title}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  )
}
