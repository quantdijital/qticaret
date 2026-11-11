import type { ProviderKind, ProvisioningKind, RunStatus } from "./models/provisioning-run"
import type { StepStatus } from "./models/provisioning-step"

/** A step as the module returns it (Ek C10): no secret, no link, no address. */
export interface StepView {
  id: string
  name: string
  position: number
  status: StepStatus
  attempts: number
  created: boolean
  error_code: string | null
  output: Record<string, unknown> | null
  started_at: Date | null
  finished_at: Date | null
}

export interface RunView {
  id: string
  tenant_id: string
  kind: ProvisioningKind
  status: RunStatus
  provider: ProviderKind
  requested_by: string | null
  port: number | null
  error_code: string | null
  started_at: Date
  finished_at: Date | null
  heartbeat_at: Date
  steps?: StepView[]
}

export interface OpenRunInput {
  tenant_id: string
  kind: ProvisioningKind
  provider: ProviderKind
  requested_by: string | null
  steps: readonly string[]
}

/** The local provisioner's ports (adr/0061 §6.3). */
export const PORT_RANGE: { readonly from: number; readonly to: number } = { from: 9200, to: 9299 }

// A run whose process died says nothing; the longest step (a command) ends within 20 minutes
export const STALE_AFTER_MS = 30 * 60 * 1000
