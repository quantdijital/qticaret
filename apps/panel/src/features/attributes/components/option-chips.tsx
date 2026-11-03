import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChipInput } from "@/components/patterns/chip-input"
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
    if (next.length > value.length) {
      onChange(next)
    }
    setText("")
  }
  return (
    <ChipInput
      chips={value.map((option) => ({ key: option.value, label: option.label }))}
      text={text}
      onTextChange={setText}
      onCommit={add}
      onRemove={(index) => {
        onChange(value.filter((_, at) => at !== index))
      }}
      removeLabel={(option) => t("attributes.removeOption", { option })}
      aria-label={t("attributes.options")}
      placeholder={t("attributes.optionsPlaceholder")}
    />
  )
}
