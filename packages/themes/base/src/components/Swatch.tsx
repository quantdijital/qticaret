import { cn } from "@qticaret/ui/lib/utils"

/**
 * A colour circle (F18 D5). Drawn with SVG's `fill`, a presentation
 * attribute: the storefront's CSP allows no `style` attribute it does not
 * know by hash, so a `style={{ backgroundColor }}` would not paint in
 * production.
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
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
    </svg>
  )
}
