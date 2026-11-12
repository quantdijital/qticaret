import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { StaffRole } from "@/features/auth/api"
import { TENANTS_KEY, tenantKey, tenantPath } from "@/features/tenants/api"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"

/**
 * Releases and a shop's version as the control plane answers them
 * (adr/0061 F17.5, Ek C18). What a shop runs is its latest usage report;
 * a target only records intent (nothing upgrades a shop until F16.6).
 */

export interface Release {
  id: string
  version: string
  commit: string
  notes: string | null
  /** Who added it (a name). */
  created_by: string | null
  created_at: string
  /** Live shops whose latest report is this release. */
  reported_count: number
  /** Live shops with this release as their target. */
  target_count: number
}

export interface ShopVersion {
  reported: { version: string; commit: string; reported_at: string } | null
  target: {
    id: string
    version: string
    commit: string
    set_at: string
    set_by: string | null
    /** Why, as typed: to the roles that set targets only (null otherwise). */
    reason: string | null
  } | null
  /** Null when either side is missing. */
  matches: boolean | null
}

/** The shops list's version column. */
export interface RowVersion {
  reported: { version: string; commit: string } | null
  target: { version: string } | null
  drift: boolean
}

export const RELEASE_NOTES_MAX = 2000
export const TARGET_REASON_MAX = 500
/** Strict semver, as the control plane takes it (lib/fleet/releases.ts). */
export const RELEASE_VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
export const RELEASE_COMMIT = /^[0-9a-fA-F]{7,40}$/

const RELEASES_KEY = ["releases"] as const

export const releasesQuery = () =>
  queryOptions({
    queryKey: RELEASES_KEY,
    queryFn: () => api<{ releases: Release[] }>("/admin/cp/releases"),
  })

/** Releases and a shop's target: who runs shops (route table). */
export const canManageReleases = (role: StaffRole | null | undefined) =>
  role === "owner" || role === "operator"

const post = <O = unknown>(path: string, body: unknown, headers: Record<string, string>) =>
  api<O>(path, { method: "POST", body, headers })

function useReleaseChange<I>(call: (input: I) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: call,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: RELEASES_KEY })
    },
  })
}

/** A new release (step-up): version, commit, an optional note. */
export const useAddRelease = () =>
  useReleaseChange((input: { version: string; commit: string; notes: string }) =>
    withStepUp((headers) => post<{ release: Release }>("/admin/cp/releases", input, headers))
  )

/** A release's note (step-up); blank clears it. */
export const useSetReleaseNotes = (id: string) =>
  useReleaseChange((notes: string) =>
    withStepUp((headers) =>
      post(`/admin/cp/releases/${encodeURIComponent(id)}`, { notes }, headers)
    )
  )

/** A shop's target release, or none (step-up), with the reason. */
export function useSetTargetRelease(tenantId: string) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: (input: { release_id: string | null; reason: string }) =>
      withStepUp((headers) => post(tenantPath(tenantId, "/target-release"), input, headers)),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: tenantKey(tenantId) })
      await client.invalidateQueries({ queryKey: [...TENANTS_KEY, "list"] })
      await client.invalidateQueries({ queryKey: RELEASES_KEY })
    },
  })
}
