import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"

/**
 * A thin "+" between two section rows (the owner, 2026-11-27: the Flatsome
 * / Shopify way): it shows while pointed at or reached by the keyboard and
 * opens the section chooser aimed at this place. It takes no room of its
 * own (the rows keep their height and their gap); a touch screen, with
 * nothing to point with, uses the row menu's "Üstüne / Altına bölüm ekle".
 */
export function InsertLine({
  name,
  hidden,
  onInsert,
}: {
  /** The name of the row it stands above, for its label. */
  name: string
  /** A row is being dragged: the line keeps out of the drop's way. */
  hidden: boolean
  onInsert: () => void
}) {
  const { t } = useTranslation()
  return (
    <li role="presentation" className="relative -mt-0.5 h-0 [@media(hover:none)]:hidden">
      <button
        type="button"
        aria-label={t("storefront.editor.row.insertAbove", { name })}
        data-insert-line=""
        className={cn(
          "absolute inset-x-1 -top-[5px] z-20 flex h-2.5 cursor-pointer items-center rounded-sm opacity-0 transition-opacity duration-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none [html:not([data-input=pointer])_&:focus-visible]:outline-1 [html:not([data-input=pointer])_&:focus-visible]:outline-offset-2 [html:not([data-input=pointer])_&:focus-visible]:outline-ring",
          hidden && "pointer-events-none invisible"
        )}
        onClick={onInsert}
      >
        <span aria-hidden="true" className="h-0.5 flex-1 rounded-full bg-primary" />
        <span
          aria-hidden="true"
          className="mx-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="size-3" />
        </span>
        <span aria-hidden="true" className="h-0.5 flex-1 rounded-full bg-primary" />
      </button>
    </li>
  )
}
