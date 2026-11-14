import { ListTree } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"

const M = "storefront.editor.pendingMenus"

interface PendingMenusProps {
  /** How many menus the draft would put live. */
  count: number
  /** The set left out of the draft: publishing leaves the shop's menus alone. */
  onDrop: () => void
}

/**
 * The draft carries a menu set (a restored revision's, adr/0063 §3):
 * "Yayınla" replaces the shop's menus with it. Said before publishing, and
 * the set may be left out; menus themselves are the Menüler screen's.
 */
export function PendingMenus({ count, onDrop }: PendingMenusProps) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="mx-3 mt-3 flex flex-col gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-[13px] leading-5 text-warning-text"
    >
      <p className="flex items-start gap-2">
        <ListTree className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t(`${M}.text`, { count })}</span>
      </p>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onDrop}>
        {t(`${M}.drop`)}
      </Button>
    </div>
  )
}
