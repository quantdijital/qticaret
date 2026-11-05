import { cn } from "@qticaret/ui/lib/utils"

/**
 * A line's price as the storefront formatted it: what the shopper pays,
 * heavy, in the deal's red when a discount took something off, the price
 * before it struck through above it, read as "Önceki fiyat:".
 */
export function LinePrice({
  total,
  original,
  before,
  large = false,
  className,
}: {
  total: string
  /** The line before its discount; null without one. */
  original: string | null
  /** "Önceki fiyat:", for the reader. */
  before: string
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
    </p>
  )
}
