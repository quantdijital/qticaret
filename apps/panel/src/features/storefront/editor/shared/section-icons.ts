import {
  CalendarDays,
  Camera,
  Compass,
  Gem,
  Headset,
  Heart,
  House,
  Landmark,
  Leaf,
  MapPin,
  Mountain,
  Package,
  Plane,
  Sparkles,
  Star,
  Sun,
  Tag,
  TreePalm,
  Users,
  Utensils,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { SectionIcon } from "@qticaret/types"
import { BADGE_ICONS } from "./badge-icons"

/**
 * The sections' icon set (`SECTION_ICONS`, adr/0077 §10 Ek) as the
 * storefront draws it: the trust badges' eight first, then the general
 * pictures, each the same line icon the theme draws.
 */
export const SECTION_ICON_GLYPHS: Record<SectionIcon, LucideIcon> = {
  ...BADGE_ICONS,
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
