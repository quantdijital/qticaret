import { Loader2 } from "lucide-react"
import { useEffect, useRef } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"

// A key pressed in a list or menu that is open (a picker's options): its own Esc closes that first
const inOpenPopup = (target: EventTarget): boolean =>
  target instanceof HTMLElement && target.getAttribute("aria-expanded") === "true"

/**
 * A narrow column card's form in place of its facts (docs/06 "Ürün
 * sayfası"): its fields, "Vazgeç" and "Kaydet" under them. The first field
 * takes the focus; Esc is "Vazgeç"; letting go of a change asks first
 * ("Değişiklikleri at"), as a form dialog does. Saving closes it.
 */
export function SideForm({
  label,
  hint,
  dirty,
  saving,
  onSubmit,
  onCancel,
  children,
}: {
  /** The form's name for screen readers: the card's title. */
  label: string
  /** What the fields are for, above them. */
  hint?: string | undefined
  dirty: boolean
  saving: boolean
  onSubmit: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const form = useRef<HTMLFormElement>(null)
  const { guard, confirm } = useDiscardGuard(dirty)
  useEffect(() => {
    const first = form.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), button[role=combobox], [role=checkbox], select, textarea"
    )
    first?.focus({ preventScroll: true })
  }, [])
  const cancel = () => {
    guard(onCancel)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    // A key from a popup drawn elsewhere (a picker's list) bubbles here through React: not ours
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      !form.current?.contains(event.target as Node) ||
      inOpenPopup(event.target)
    ) {
      return
    }
    event.preventDefault()
    cancel()
  }
  return (
    <>
      <form
        ref={form}
        noValidate
        aria-label={label}
        className="flex min-w-0 flex-col gap-4"
        onKeyDown={onKeyDown}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
        {children}
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button type="button" variant="cancel" size="sm" disabled={saving} onClick={cancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </div>
      </form>
      {confirm}
    </>
  )
}
