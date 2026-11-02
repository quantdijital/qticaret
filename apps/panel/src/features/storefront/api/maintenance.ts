import { queryOptions, useMutation } from "@tanstack/react-query"
import { sectionQuery } from "@/features/settings/api/sections"
import { sdk } from "@/lib/sdk"

/**
 * Maintenance or "coming soon" (adr/0053, backend
 * `platform-settings/sections/maintenance.ts`): while on, the storefront
 * answers its pages with 503 and a plain page, but for its system paths,
 * the paths the shop leaves open and visitors holding a bypass link.
 */
export interface MaintenanceSettings {
  enabled: boolean
  /** The plain page's heading, 80 at most; none: the storefront's own. */
  title: string | null
  /** A line under it, 600 at most; may hold the shop's details (`{telefon}`). */
  message: string | null
  /** When the shop expects to be back, ISO 8601 with its offset; feeds `Retry-After`. */
  expected_at: string | null
  /** Shop paths left open: exact (`/iletisim`) or a path and below it (`/sozlesmeler/*`). */
  allow_paths: string[]
}

export const MAINTENANCE_SECTION = "maintenance"

/**
 * The section, asked for once per visit: the panel's banner and the
 * maintenance tab share it, and a save puts the stored values in its place.
 */
export const maintenanceQuery = () =>
  queryOptions({ ...sectionQuery<MaintenanceSettings>(MAINTENANCE_SECTION), staleTime: Infinity })

/** A link past the maintenance page: a week, and until the section is saved again. */
export interface BypassLink {
  /** The whole address when the shop's host is known, else the path. */
  url: string
  path: string
  expires_at: string
}

/** `POST /admin/maintenance/bypass` (owner and admin); refused while maintenance is off. */
export function useBypassLink() {
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<BypassLink>("/admin/maintenance/bypass", { method: "POST", body: {} }),
  })
}
