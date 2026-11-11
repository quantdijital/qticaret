import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { inviteOwnerResultSchema } from "@qticaret/types/control-plane"
import type { TenantRecord } from "../../modules/tenants/types"
import { tenantsIn } from "../../workflows/modules"
import { isLocalEnv, parseEnv } from "../env"
import { ownerInviteEmail } from "../mail/invite"
import { emailTransport } from "../mail/transport"
import { ownerInviteLinkProblem } from "./invite-link"
import { provisioner } from "./provider"
import type { ProvisionTarget } from "./provisioner"

type Container = Pick<MedusaContainer, "resolve">

export interface InviteOutcome {
  status: "succeeded" | "skipped"
  /** Whether the e-mail went; never the address or the link. */
  output: Record<string, unknown>
  /** Why the owner did not get it (a warning: the shop stays up). */
  warning?: string
}

/**
 * The shop's owner invitation (adr/0061 §6.2, Ek C10): its first `owner`
 * contact's address goes to `tenant:invite-owner`, the link the shop
 * prints is checked and mailed with the control plane's own sender, then
 * dropped. Nothing of it is stored or logged (the run keeps only whether
 * it went). Each call is a new link; the shop voids the old one.
 */
export async function sendOwnerInvite(
  container: Container,
  tenant: TenantRecord,
  target: ProvisionTarget
): Promise<InviteOutcome> {
  const owner = (await tenantsIn(container).contactsOf(tenant.id)).find(
    (contact) => contact.role === "owner"
  )
  if (!owner) {
    return {
      status: "succeeded",
      output: { mailed: false },
      warning: "provisioning.no_owner_contact",
    }
  }
  const outcome = await provisioner().runTenantCommand(target, {
    name: "invite-owner",
    email: owner.email.trim().toLowerCase(),
  })
  const parsed = inviteOwnerResultSchema.safeParse(outcome.result)
  if (!outcome.ok || !parsed.success) {
    return { status: "succeeded", output: { mailed: false }, warning: "provisioning.invite_failed" }
  }
  const result = parsed.data
  if (result.status === "owner_exists") {
    return { status: "skipped", output: { mailed: false, owner: "exists" } }
  }
  if (result.status === "address_taken") {
    return {
      status: "succeeded",
      output: { mailed: false },
      warning: "provisioning.owner_address_taken",
    }
  }
  const problem = ownerInviteLinkProblem(result.link, isLocalEnv(parseEnv()))
  if (problem) {
    return { status: "succeeded", output: { mailed: false }, warning: problem }
  }
  const transport = emailTransport()
  if (!transport) {
    return { status: "succeeded", output: { mailed: false }, warning: "provisioning.mail_off" }
  }
  try {
    await transport.send(ownerInviteEmail(owner.email, tenant.name, result.link))
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `cp.owner_invite_mail_failed ${JSON.stringify({ tenant_id: tenant.id, err: errorSummary(error) })}`
      )
    return { status: "succeeded", output: { mailed: false }, warning: "provisioning.mail_failed" }
  }
  return { status: "succeeded", output: { mailed: true } }
}
