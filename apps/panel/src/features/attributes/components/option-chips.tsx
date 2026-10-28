import { X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { optionValue } from "@/features/attributes/form"
import type { AttributeOption } from "@/features/attributes/types"

/** A select attribute's options, typed as chips; each value is the slug of its label (F3.17 facets). */
export function OptionChips({
  value,
  onChange,
}: {
  value: AttributeOption[]
  onChange: (next: AttributeOption[]) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const add = () => {
    const labels = text
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
    const next = [...value]
    for (const label of labels) {
      const slug = optionValue(label)
      if (slug && !next.some((option) => option.value === slug)) {
        next.push({ value: slug, label })
      }
    }
    onChange(next)
    setText("")
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
      {value.map((option) => (
        <span
          key={option.value}
          className="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[13px]"
        >
          {option.label}
          <button
            type="button"
            aria-label={t("attributes.removeOption", { option: option.label })}
            onClick={() => {
              onChange(value.filter((item) => item.value !== option.value))
            }}
            className="opacity-70 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        aria-label={t("attributes.options")}
        placeholder={value.length ? "" : t("attributes.optionsPlaceholder")}
        onChange={(event) => {
          setText(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault()
            add()
          }
        }}
        onBlur={add}
        className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
