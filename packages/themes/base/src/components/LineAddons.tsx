import type { LineAddonView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A line's add-on picks under it (adr/0052 §9): "Ürün üzerine yazı: Ahmet
 * (+35,00 TL)", one each. The typed text is plain text (React escapes it).
 * The same on the cart, the drawer, the checkout and the order.
 */
export function LineAddons({
  addons,
  note = null,
  className,
}: {
  addons: readonly LineAddonView[]
  /** A line made to the buyer's wish says so, in words; null: nothing to say. */
  note?: string | null
  className?: string
}) {
  if (addons.length === 0) {
    return null
  }
  return (
    <ul className={cn("flex flex-col gap-0.5 text-xs text-muted-foreground", className)}>
      {addons.map((addon, index) => (
        <li key={`${String(index)}:${addon.label}`} className="break-words">
          <span className="font-medium text-foreground/80">{addon.label}:</span>{" "}
          {addon.value ?? "—"}
          {addon.amount && <span className="tabular"> ({addon.amount})</span>}
        </li>
      ))}
      {note && <li className="font-medium text-sale">{note}</li>}
    </ul>
  )
}
