import {
  Award,
  CalendarDays,
  Camera,
  Clock,
  Compass,
  CreditCard,
  Gem,
  Gift,
  Headset,
  Heart,
  House,
  Landmark,
  Leaf,
  MapPin,
  Mountain,
  Package,
  Phone,
  Plane,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Tag,
  TreePalm,
  Truck,
  Users,
  Utensils,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { SectionIcon as SectionIconName } from "@qticaret/types"

/**
 * The sections' icon set (`SECTION_ICONS`, adr/0077 §10 Ek) in this theme:
 * the same line icons as the trust badges (`TrustIcon`), their first eight
 * the badges' own, the rest from the same set at the same stroke.
 */
const ICONS: Record<SectionIconName, LucideIcon> = {
  truck: Truck,
  clock: Clock,
  shield: ShieldCheck,
  card: CreditCard,
  refresh: RefreshCw,
  award: Award,
  gift: Gift,
  phone: Phone,
  compass: Compass,
  map_pin: MapPin,
  plane: Plane,
  mountain: Mountain,
  palm: TreePalm,
  leaf: Leaf,
  sun: Sun,
  landmark: Landmark,
  house: House,
  heart: Heart,
  users: Users,
  star: Star,
  sparkles: Sparkles,
  camera: Camera,
  calendar: CalendarDays,
  tag: Tag,
  package: Package,
  headset: Headset,
  utensils: Utensils,
  gem: Gem,
}

/** A section's icon, for the eye only (its words say it), at 24 px unless sized. */
export function SectionIcon({ icon, className }: { icon: SectionIconName; className?: string }) {
  const Icon = ICONS[icon]
  return <Icon className={className ?? "size-6 shrink-0"} aria-hidden="true" strokeWidth={1.75} />
}
