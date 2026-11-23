import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { AttributeOption } from "@/features/attributes/types"

/** Adds a label to the field's list; resolves to the new value, null when it was not added. */
export type AddValue = (label: string) => Promise<string | null>

/**
 * A value missing from a list field, typed where the product is filled
 * in: "Yeni değer ekle" opens a line, Enter or "Ekle" adds it to the
 * group and picks it, Escape closes the line.
 */
export function NewValue({
  label,
  open,
  onOpenChange,
  add,
  onAdded,
}: {
  /** The field's name, for the line's own name. */
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  add: AddValue
  onAdded: (option: AttributeOption) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start px-1.5 text-muted-foreground"
        onClick={() => {
          onOpenChange(true)
        }}
      >
        <Plus />
        {t("attributes.newValue")}
      </Button>
    )
  }
  const submit = async () => {
    const typed = text.trim()
    if (!typed || busy) {
      return
    }
    setBusy(true)
    const value = await add(typed)
    setBusy(false)
    if (value) {
      onAdded({ value, label: typed })
      setText("")
      onOpenChange(false)
    }
  }
  return (
    <div className="flex gap-2">
      <Input
        autoFocus
        value={text}
        aria-label={t("attributes.newValueName", { label })}
        placeholder={t("attributes.newValue")}
        disabled={busy}
        onChange={(event) => {
          setText(event.target.value)
        }}
        onKeyDown={(event) => {
          // The card around it is a form: Enter adds the value, not saves the card
          if (event.key === "Enter") {
            event.preventDefault()
            void submit()
          } else if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            onOpenChange(false)
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy || !text.trim()}
        onClick={() => void submit()}
      >
        {t("attributes.addValue")}
      </Button>
    </div>
  )
}
