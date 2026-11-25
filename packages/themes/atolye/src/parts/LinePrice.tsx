import { cn } from "@qticaret/ui/lib/utils"

/**
 * A line's price as the storefront formatted it: what the shopper pays,
 * heavy, in the deal's red when a discount took something off, the amount
 * before it struck through above it, read with `before` (a cart line's
 * "Promosyon indirimi:", adr/0076 Ek 2026-11-25); a wholesaler's "KDV
 * hariç" under a total without KDV (ADR-0068).
 */
export function LinePrice({
  total,
  original,
  before,
  note,
  large = false,
  className,
}: {
  total: string
  /** The line before its discount; null without one. */
  original: string | null
  /** What the struck amount is, for the reader: "Promosyon indirimi:" on a cart line. */
  before: string
  /** "KDV hariç" for a wholesaler's line; none for anyone else's. */
  note?: string | null | undefined
  large?: boolean
  className?: string
}) {
  return (
    <p className={cn("tabular flex shrink-0 flex-col items-end leading-tight", className)}>
      {original && (
        <s className="text-xs text-text-3">
          <span className="sr-only">{before} </span>
          {original}
        </s>
      )}
      <span
        className={cn(
          "font-extrabold tracking-[-0.01em]",
          large ? "text-lg" : "text-md",
          original && "text-deal"
        )}
      >
        {total}
      </span>
      {note && <span className="text-xs text-text-2">{note}</span>}
    </p>
  )
}
