import { cn } from "@qticaret/ui/lib/utils"

/**
 * A colour the shop named for a value (`#rrggbb`), as a circle. Drawn
 * with SVG's `fill`, a presentation attribute: the storefront's CSP
 * refuses a `style` attribute, so a background colour would not paint.
 */
export function Swatch({ hex, className }: { hex: string; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("shrink-0", className)}>
      <circle
        cx="10"
        cy="10"
        r="9.25"
        fill={hex}
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1.5"
      />
    </svg>
  )
}
