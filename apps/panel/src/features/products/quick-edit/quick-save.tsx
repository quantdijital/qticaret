import { Loader2, PencilLine } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { QuickEdit } from "./use-quick-edit"

const Q = "products.quickEdit"

/**
 * The quick edit's save in the page header (as the product page's): while
 * values differ, "Vazgeç" (asked first) and "N değişikliği kaydet";
 * leaving the page with them asks first. Nothing while nothing differs.
 */
export function QuickSave({ edit }: { edit: QuickEdit }) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  if (edit.count === 0 && !edit.saving) {
    return null
  }
  return (
    <div role="group" aria-label={t(`${Q}.label`)} className="flex items-center gap-2">
      <Button
        variant="cancel"
        disabled={edit.saving}
        onClick={() => {
          setAsking(true)
        }}
      >
        {t("common.cancel")}
      </Button>
      <Button disabled={edit.saving || edit.invalid} onClick={edit.save}>
        {edit.saving ? <Loader2 className="animate-spin" /> : null}
        {t(`${Q}.save`, { count: edit.count })}
      </Button>
      <LeaveGuard when={edit.count > 0 && !edit.saving} />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${Q}.discardTitle`)}
        description={t(`${Q}.discardText`, { count: edit.count })}
        confirmLabel={t(`${Q}.discard`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          edit.reset()
        }}
      />
    </div>
  )
}

/**
 * "Hızlı düzenle" beside the list's options: turns the price, stock and
 * status cells into fields. It stays on while changes wait to be saved.
 */
export function QuickToggle({ edit }: { edit: QuickEdit }) {
  const { t } = useTranslation()
  const locked = edit.on && edit.count > 0
  return (
    <Button
      variant={edit.on ? "secondary" : "outline"}
      aria-pressed={edit.on}
      disabled={locked}
      title={locked ? t(`${Q}.lockedHint`) : undefined}
      onClick={() => {
        edit.setOn(!edit.on)
      }}
    >
      <PencilLine />
      <span className="max-sm:sr-only">{t(`${Q}.toggle`)}</span>
    </Button>
  )
}
