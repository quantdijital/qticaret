import type { MedusaContainer } from "@medusajs/framework/types"
import { planImportResultSchema } from "@qticaret/types/control-plane"
import { tenantApiUrlProblem } from "../../lib/fleet/push-target"
import { reissuePlanDocuments } from "../../lib/fleet/reissue"
import { ProvisioningError } from "../../lib/provisioning/provisioner"
import type { ProvisionTarget } from "../../lib/provisioning/provisioner"
import { provisioner } from "../../lib/provisioning/provider"
import { sendOwnerInvite } from "../../lib/provisioning/owner-invite"
import { issuePlanDocumentWorkflow } from "../fleet/plan-document"
import { fleetIn, provisioningIn, tenantsIn } from "../modules"
import { provisionStep } from "./step"
import type { RunInput } from "./step"
import { contextOf } from "./target"

const HEALTH_WAIT_MS = 3 * 60 * 1000
const HEALTH_EVERY_MS = 2_000

/**
 * 7. The first plan document (adr/0061 §6.2): issued if its content
 * changed (a retry finds the same one), then imported into the shop by
 * `tenant:plan-import`, which checks it as a push. The document is the
 * shop's history and stays when a later step fails (the shop's database,
 * which took it, does not).
 */
export const planDocumentStep = provisionStep("plan_document", async (input, container) => {
  const { target } = await contextOf(container, input.tenant_id)
  await issuePlanDocumentWorkflow(container).run({ input: { tenant_id: target.tenant_id } })
  const latest = await fleetIn(container).latestPlanDocument(target.tenant_id)
  if (!latest) {
    throw new ProvisioningError("provisioning.no_plan_document")
  }
  const outcome = await provisioner().runTenantCommand(target, {
    name: "plan-import",
    document: JSON.stringify({
      document: latest.document,
      kid: latest.kid,
      signature: latest.signature,
    }),
  })
  const parsed = planImportResultSchema.safeParse(outcome.result)
  if (!parsed.success) {
    throw new ProvisioningError("provisioning.plan_import_failed")
  }
  if (parsed.data.status !== "applied" && parsed.data.status !== "same") {
    throw new ProvisioningError("provisioning.plan_import_refused")
  }
  return {
    status: "succeeded",
    created: false,
    output: { serial: parsed.data.serial, imported: parsed.data.status },
  }
})

/** 8. The shop's backend started; running already (ours): skipped. Undone: stopped. */
export const startStep = provisionStep<ProvisionTarget>(
  "start",
  async (input, container) => {
    const { target } = await contextOf(container, input.tenant_id)
    if ((await provisioner().probe(target)).running) {
      return { status: "skipped", created: false, output: { running: true } }
    }
    await provisioner().start(target)
    return { status: "succeeded", created: true, output: { port: target.port }, undo: target }
  },
  async (target) => {
    await provisioner().stop(target)
  }
)

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 9. Its `/health` green within three minutes. */
export const healthStep = provisionStep("health", async (input, container) => {
  const { target } = await contextOf(container, input.tenant_id)
  const until = Date.now() + HEALTH_WAIT_MS
  for (;;) {
    const seen = await provisioner().probe(target)
    if (seen.healthy) {
      return {
        status: "succeeded",
        created: false,
        output: { status: seen.status, latency_ms: seen.latency_ms },
      }
    }
    if (!seen.running) {
      throw new ProvisioningError("provisioning.shop_exited")
    }
    if (Date.now() > until) {
      throw new ProvisioningError("provisioning.health_timeout")
    }
    // The run is alive while it waits
    await provisioningIn(container).heartbeat(input.run_id)
    await pause(HEALTH_EVERY_MS)
  }
})

/** Where the control plane reaches a shop's backend: this machine's port here; F16 names a service. */
export const apiBaseUrlOf = (target: ProvisionTarget): string =>
  `http://localhost:${String(target.port)}`

/**
 * 10. The shop's address for its plan document's push (Ek C9), checked by
 * the push policy first. The same already: skipped. Undone: the old one.
 */
export const apiUrlStep = provisionStep<{ tenant_id: string; from: string | null }>(
  "api_url",
  async (input, container) => {
    const { tenant, target } = await contextOf(container, input.tenant_id)
    const url = apiBaseUrlOf(target)
    if (tenantApiUrlProblem(url)) {
      throw new ProvisioningError("provisioning.api_url_refused")
    }
    if (tenant.api_base_url === url) {
      return { status: "skipped", created: false, output: { api_base_url: url } }
    }
    await tenantsIn(container).updateTenants({ id: tenant.id, api_base_url: url })
    return {
      status: "succeeded",
      created: true,
      output: { api_base_url: url },
      undo: { tenant_id: tenant.id, from: tenant.api_base_url },
    }
  },
  async (undo, _run, container) => {
    await tenantsIn(container).updateTenants({ id: undo.tenant_id, api_base_url: undo.from })
  }
)

async function inviteStepBody(input: RunInput, container: MedusaContainer) {
  const { tenant, target } = await contextOf(container, input.tenant_id)
  const sent = await sendOwnerInvite(container, tenant, target)
  return {
    status: sent.status,
    created: false,
    output: sent.output,
    ...(sent.warning ? { warning: sent.warning } : {}),
  }
}

/**
 * 11. The owner's invitation (adr/0061 §6.2): the shop makes the link, the
 * control plane mails it and keeps nothing. Never fails the setup: a shop
 * that is up stays up. Mailed by an earlier run already: skipped (a setup
 * run again changes nothing); "send again" is its own run (`resend_invite`).
 */
export const ownerInviteStep = provisionStep("owner_invite", async (input, container) => {
  if (await provisioningIn(container).ownerInvited(input.tenant_id)) {
    return { status: "skipped", created: false, output: { mailed: false, sent_before: true } }
  }
  return await inviteStepBody(input, container)
})

/** "Yeniden gönder": a new link (the shop voids the old one), mailed. */
export const resendInviteStep = provisionStep("resend_invite", inviteStepBody)

/**
 * 12. The shop `active` (adr/0061 §2: once its health is green), and its
 * document issued again with that status, now pushed to its address.
 * Already active: skipped. The last step: nothing after it undoes it.
 */
export const activateStep = provisionStep("activate", async (input, container) => {
  const tenant = await tenantsIn(container).tenantOf(input.tenant_id)
  if (tenant.status === "active") {
    return { status: "skipped", created: false, output: { status: "active" } }
  }
  const run = await provisioningIn(container).runOf(tenant.id, input.run_id)
  await tenantsIn(container).changeStatus(tenant.id, "active", {
    reason_code: "provisioned",
    actor: run.requested_by ?? "system",
  })
  const issued = (await reissuePlanDocuments(container, [tenant.id])).get(tenant.id)
  return {
    status: "succeeded",
    created: false,
    output: { status: "active", serial: issued?.serial ?? null },
  }
})
