import { useCallback } from "react"
import { useCan } from "@/features/auth/api/staff"

/**
 * A message that sends people to Settings > Audit log > Jobs, as its key:
 * the key itself for a role that may open that page, its `…NoJobs`
 * sibling (the same news without the pointer) for one that may not
 * (the owner, 2026-11-23: a role without the audit log sees no jobs).
 * Stable while the role is, so effects may depend on it.
 */
export function useJobsMessage(): (key: string) => string {
  const seesJobs = useCan("audit")
  return useCallback((key: string) => (seesJobs ? key : `${key}NoJobs`), [seesJobs])
}
