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
 * The shop's promises (free shipping, same-day dispatch…) as one ruled row:
 * two by two on a phone, four across from 1024 px; the icon in the text's
 * colour, the title 14/500, its line 13. Nothing here is a control, so
 * nothing answers a pointer. None: nothing drawn.
 */
export function TrustStrip({
  badges,
  label,
  className,
}: {
  badges: readonly TrustBadgeView[]
  label: string
  className?: string
}) {
  if (badges.length === 0) {
    return null
  }
  return (
    <ul
      aria-label={label}
      className={cn(
        "grid grid-cols-2 border-t-2 border-rule-ink lg:grid-cols-4",
        badges.length % 2 === 1 && "max-lg:[&>li:last-child]:col-span-2",
        className
      )}
    >
      {badges.map((badge) => {
        const Icon = ICONS[badge.icon]
        return (
          <li
            key={badge.title}
            className="flex items-start gap-3 border-b border-rule py-4 pr-4 odd:max-lg:border-r odd:max-lg:pl-0 even:max-lg:pl-4 lg:border-b-0 lg:border-l lg:px-6 lg:py-6 lg:first:border-l-0 lg:first:pl-0"
          >
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{badge.title}</span>
              {badge.text && <span className="text-xs text-text-2">{badge.text}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
