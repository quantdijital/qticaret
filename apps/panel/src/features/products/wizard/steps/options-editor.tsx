import { Plus, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChipInput } from "@/components/patterns/chip-input"
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
      .filter(
        (value, at, all) => value && !option.values.includes(value) && all.indexOf(value) === at
      )
    if (values.length) {
      onChange([...option.values, ...values])
    }
    setText("")
  }
  return (
    <ChipInput
      chips={option.values.map((value) => ({ key: value, label: value }))}
      text={text}
      onTextChange={setText}
      onCommit={add}
      onRemove={(index) => {
        onChange(option.values.filter((_, at) => at !== index))
      }}
      removeLabel={(value) => t("products.wizard.options.removeValue", { value })}
      aria-label={t("products.wizard.options.values", { option: option.title })}
      placeholder={t("products.wizard.options.valuesPlaceholder")}
    />
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
