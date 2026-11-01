import {
  Award,
  Clock,
  CreditCard,
  Gift,
  type LucideIcon,
  Phone,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react"
import type { TrustBadgeView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

const ICONS: Record<TrustBadgeView["icon"], LucideIcon> = {
  truck: Truck,
  clock: Clock,
  shield: ShieldCheck,
  card: CreditCard,
  refresh: RefreshCw,
  award: Award,
  gift: Gift,
  phone: Phone,
}

/**
 * The shop's promises (free shipping, same-day dispatch…): a card with
 * one cell per promise on wide screens, two per row on phones.
 */
export function TrustStrip({
  badges,
  label,
  compact = false,
  className,
}: {
  badges: TrustBadgeView[]
  label: string
  /** Two columns and smaller type, in a box beside the cart form. */
  compact?: boolean
  className?: string
}) {
  if (badges.length === 0) {
    return null
  }
  return (
    <ul
      aria-label={label}
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-2xl border bg-card",
        !compact && "lg:grid-cols-4",
        className
      )}
    >
      {badges.map((badge) => {
        const Icon = ICONS[badge.icon]
        return (
          <li
            key={badge.title}
            className={cn(
              "-mt-px -ml-px flex items-start gap-3 border-t border-l",
              compact ? "p-4" : "p-5 lg:p-6"
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
                compact ? "size-8" : "size-10"
              )}
            >
              <Icon className={compact ? "size-4" : "size-5"} aria-hidden="true" />
            </span>
            <span className={compact ? "text-xs" : "text-sm"}>
              <span className="block font-semibold">{badge.title}</span>
              {badge.text && (
                <span className="mt-0.5 block text-muted-foreground">{badge.text}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
