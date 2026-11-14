import { Award, Clock, CreditCard, Gift, Phone, RefreshCw, ShieldCheck, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { TrustIcon } from "@/features/settings/api/sections"

/** Each icon as the storefront draws it (docs/19 §4). */
export const BADGE_ICONS: Record<TrustIcon, LucideIcon> = {
  truck: Truck,
  clock: Clock,
  shield: ShieldCheck,
  card: CreditCard,
  refresh: RefreshCw,
  award: Award,
  gift: Gift,
  phone: Phone,
}
