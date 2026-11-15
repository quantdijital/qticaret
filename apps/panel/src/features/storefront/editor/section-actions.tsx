import { Copy, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"

const P = "storefront.editor.panel"

/**
 * The section copied (a page's body only) or taken off; both undone with
 * "Geri al". When a per-page limit stops the copy, `note` says so under
 * the buttons.
 */
export function SectionActions({
  canCopy,
  canDuplicate,
  note = null,
  onDuplicate,
  onRemove,
}: {
  canCopy: boolean
  canDuplicate: boolean
  note?: string | null
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 border-t px-5 py-4">
      <div className="flex flex-wrap gap-2">
        {canCopy ? (
          <Button type="button" variant="outline" disabled={!canDuplicate} onClick={onDuplicate}>
            <Copy />
            {t(`${P}.duplicate`)}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="text-destructive-text" onClick={onRemove}>
          <Trash2 />
          {t(`${P}.remove`)}
        </Button>
      </div>
      {canCopy && !canDuplicate && note ? (
        <p className="text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  )
}
