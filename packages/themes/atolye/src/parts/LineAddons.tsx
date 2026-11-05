import type { LineAddonView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A line's add-on picks under its name (adr/0052 §9), the gift wrap or
 * the engraving: "Ürün üzerine yazı: Ahmet (+35,00 TL)", one a line, the
 * typed text as plain text. A line made to the buyer's wish says so in
 * the deal's red. On a graphite stage the words take the stage's ink.
 */
export function LineAddons({
  addons,
  note = null,
  stage = false,
  className,
}: {
  addons: readonly LineAddonView[]
  /** The line is outside the right of withdrawal, in words; null: nothing to say. */
  note?: string | null
  stage?: boolean
  className?: string
}) {
  if (addons.length === 0) {
    return null
  }
  return (
    <ul
      className={cn(
        "flex flex-col gap-0.5 text-xs leading-snug",
        stage ? "text-stage-text-2" : "text-text-2",
        className
      )}
    >
      {addons.map((addon, index) => (
        <li key={`${String(index)}:${addon.label}`} className="break-words">
          <span className={cn("font-semibold", stage ? "text-stage-text" : "text-text")}>
            {addon.label}:
          </span>{" "}
          {addon.value ?? ""}
          {addon.amount && <span className="tabular"> ({addon.amount})</span>}
        </li>
      ))}
      {note && <li className="font-semibold text-deal">{note}</li>}
    </ul>
  )
}
