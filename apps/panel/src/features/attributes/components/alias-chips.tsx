import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChipInput } from "@/components/patterns/chip-input"

const MAX_ALIASES = 20

const folded = (text: string) => text.toLocaleLowerCase("tr").trim()

/**
 * A field's other names, typed as chips (adr/0013 Ek 2026-11-05): the
 * labels product descriptions use for it ("Üretim yeri" for "Menşei"), so
 * their facts come over to it. Each once, Turkish case folded; at most 20.
 */
export function AliasChips({
  value,
  onChange,
  id,
}: {
  value: string[]
  onChange: (next: string[]) => void
  id?: string
}) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const add = () => {
    const next = [...value]
    for (const name of text.split(",").map((each) => each.trim().slice(0, 100))) {
      if (
        name &&
        next.length < MAX_ALIASES &&
        !next.some((each) => folded(each) === folded(name))
      ) {
        next.push(name)
      }
    }
    if (next.length > value.length) {
      onChange(next)
    }
    setText("")
  }
  return (
    <ChipInput
      id={id}
      chips={value.map((name) => ({ key: folded(name), label: name }))}
      text={text}
      onTextChange={setText}
      onCommit={add}
      onRemove={(index) => {
        onChange(value.filter((_, at) => at !== index))
      }}
      removeLabel={(name) => t("attributes.removeAlias", { name })}
      aria-label={t("attributes.aliases")}
      placeholder={t("attributes.aliasesPlaceholder")}
    />
  )
}
