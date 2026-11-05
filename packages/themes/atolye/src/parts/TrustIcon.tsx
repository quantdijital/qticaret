import { Award, Clock, CreditCard, Gift, Phone, RefreshCw, ShieldCheck, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { TrustBadgeView } from "@qticaret/ui"

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

/** A promise's icon from the shop's fixed list (D3), at 24 px on the set's grid. */
export function TrustIcon({
  icon,
  className,
}: {
  icon: TrustBadgeView["icon"]
  className?: string
}) {
  const Icon = ICONS[icon]
  return <Icon className={className ?? "size-6 shrink-0"} aria-hidden="true" strokeWidth={1.75} />
}
