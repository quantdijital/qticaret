import { useQuery } from "@tanstack/react-query"
import { staffQuery } from "@/features/auth/api/staff"
import { featuresQuery } from "@/features/settings/api/features"
import type { NavItem } from "./navigation"

/**
 * Whether a menu item is offered: its flag on and its capability granted.
 * Both unknown (loading, refused) read as no, so nothing is offered on a
 * guess. `fetch: false` reads what the shell already asked (the command
 * menu), never asking the API itself.
 */
export function useNavAccess({ fetch = true }: { fetch?: boolean } = {}): (
  item: Pick<NavItem, "feature" | "needs">
) => boolean {
  const features = useQuery({ ...featuresQuery(), enabled: fetch })
  const staff = useQuery({ ...staffQuery(), enabled: fetch })
  return (item) =>
    (!item.feature ||
      (features.data?.some((feature) => feature.key === item.feature && feature.enabled) ??
        false)) &&
    (!item.needs || (staff.data?.can[item.needs] ?? false))
}
