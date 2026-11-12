import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { codeSummary } from "@qticaret/server-kit"
import { inviteOwnerResultSchema } from "@qticaret/types/control-plane"
import type { TenantRecord } from "../../modules/tenants/types"
import { tenantsIn } from "../../workflows/modules"
import { ownerInviteEmail } from "../mail/invite"
import { emailTransport } from "../mail/transport"
import { ownerInviteLink, shopPanelOrigin } from "./invite-link"
import { provisioner } from "./provider"
import { ProvisioningError } from "./provisioner"
import type { ProvisionTarget } from "./provisioner"

type Container = Pick<MedusaContainer, "resolve">

export interface InviteOutcome {
  status: "succeeded" | "skipped"
  /** Whether the e-mail went; never the address, the token or the link. */
  output: Record<string, unknown>
  /** Why the owner did not get it (a warning: the shop stays up). */
  warning?: string
}

const notSent = (warning: string): InviteOutcome => ({
  status: "succeeded",
  output: { mailed: false },
  warning,
})

/**
 * The shop's owner invitation (adr/0061 §6.2, Ek C10): its first `owner`
 * contact's address goes to `tenant:invite-owner`; the token the shop
 * prints is checked, the link built from the shop panel's known origin
 * (review M1), mailed with the control plane's own sender, then dropped.
 * Nothing of it is stored or logged (the run keeps only whether it went).
 * Each call is a new token; the shop voids the old one.
 */
export async function sendOwnerInvite(
  container: Container,
  tenant: TenantRecord,
  target: ProvisionTarget
): Promise<InviteOutcome> {
  const tenants = tenantsIn(container)
  const owner = (await tenants.contactsOf(tenant.id)).find((contact) => contact.role === "owner")
  if (!owner) {
    return notSent("provisioning.no_owner_contact")
  }
  const which = provisioner()
  const outcome = await which.runTenantCommand(target, {
    name: "invite-owner",
    email: owner.email.trim().toLowerCase(),
  })
  const parsed = inviteOwnerResultSchema.safeParse(outcome.result)
  if (!outcome.ok || !parsed.success) {
    return notSent("provisioning.invite_failed")
  }
  const result = parsed.data
  if (result.status === "owner_exists") {
    return { status: "skipped", output: { mailed: false, owner: "exists" } }
  }
  if (result.status === "address_taken") {
    return notSent("provisioning.owner_address_taken")
  }
  let link: string
  try {
    link = ownerInviteLink(
      shopPanelOrigin(which.kind, target, await tenants.domainsOf(tenant.id)),
      result.token
    )
  } catch (error) {
    return notSent(error instanceof ProvisioningError ? error.code : "provisioning.invite_failed")
  }
  const transport = emailTransport()
  if (!transport) {
    return notSent("provisioning.mail_off")
  }
  try {
    await transport.send(ownerInviteEmail(owner.email, tenant.name, link))
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `cp.owner_invite_mail_failed ${JSON.stringify({ tenant_id: tenant.id, err: codeSummary(error) })}`
      )
    return notSent("provisioning.mail_failed")
  }
  return { status: "succeeded", output: { mailed: true } }
}
