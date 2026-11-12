import type { MedusaContainer } from "@medusajs/framework/types"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import type { HealthTarget } from "../../src/modules/fleet/models/health"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { fleetOf } from "./fleet"

export const tenantsOf = (container: MedusaContainer) =>
  container.resolve<TenantsModuleService>(TENANTS_MODULE)

/** A shop moved through these statuses in order, as the system would (`system`). */
export async function moveThrough(
  container: MedusaContainer,
  tenantId: string,
  statuses: readonly TenantStatus[]
): Promise<void> {
  for (const status of statuses) {
    await tenantsOf(container).changeStatus(tenantId, status, {
      reason_code: "provisioned",
      actor: "system",
    })
  }
}

/** A usage report as received at `at` (straight in the module: the route's checks are C13's). */
export async function reportAt(
  container: MedusaContainer,
  tenantId: string,
  at: Date,
  release: { version: string; commit: string }
): Promise<void> {
  const result = await fleetOf(container).recordUsage(
    {
      version: 1,
      tenant_id: tenantId,
      reported_at: at.toISOString(),
      period: usagePeriodOf(at),
      counts: {
        products: 12,
        orders_this_month: 3,
        staff: 2,
        storage_mb: 40,
        llm_credits_this_month: 0,
      },
      last_order_at: null,
      release,
    },
    at
  )
  if (!result.stored) {
    throw new Error(`report not stored: ${result.reason}`)
  }
}

/** `times` failed probes of a shop's target, a minute apart, ending at `now`. */
export async function failProbes(
  container: MedusaContainer,
  tenantId: string,
  target: HealthTarget,
  times: number,
  now = new Date()
): Promise<void> {
  for (let n = times - 1; n >= 0; n -= 1) {
    await fleetOf(container).noteProbe(
      tenantId,
      { target, ok: false, status_code: 503, latency_ms: 12, error: "health.http_503" },
      new Date(now.getTime() - n * 60_000)
    )
  }
}
