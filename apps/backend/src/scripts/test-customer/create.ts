import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The address confirmed as a shopper's own code confirms it (adr/0037 §1,
 * Medusa's `authVerificationsPerActor`): a verification asked for the
 * identity and answered with its code, here in one go. Already confirmed,
 * nothing changes.
 */
async function confirmAddress(container: Container, identityId: string, email: string) {
  const auth = container.resolve(Modules.AUTH)
  const done = await auth.listAuthVerifications(
    { entity_type: "email", entity_id: email },
    { select: ["verified_at"], take: 10 }
  )
  if (done.some((row) => row.verified_at)) {
    return
  }
  const { code } = await auth.requestAuthVerification({
    entity_type: "email",
    entity_id: email,
    auth_identity_id: identityId,
    code_provider: "token",
  })
  if (!code) {
    throw new Error("customer:test: no verification code was made")
  }
  await auth.confirmAuthVerification({ code })
}

/**
 * A customer who can sign in at once (development only): an e-mail login
 * with this password (made, or its password set again), a customer
 * account tied to it, the address confirmed. Run again, it changes only
 * the password. Returns the customer's id.
 */
export async function createTestCustomer(
  container: MedusaContainer,
  input: { email: string; password: string }
): Promise<{ customer_id: string; created: boolean }> {
  const auth = container.resolve(Modules.AUTH)
  const [login] = await auth.listProviderIdentities(
    { entity_id: input.email, provider: "emailpass" },
    { select: ["auth_identity_id"], take: 1 }
  )
  let identityId = login?.auth_identity_id ?? null
  if (identityId) {
    const updated = await auth.updateProvider("emailpass", {
      entity_id: input.email,
      password: input.password,
    })
    if (!updated.success) {
      throw new Error("customer:test: the password could not be set")
    }
  } else {
    const registered = await auth.register("emailpass", {
      body: { email: input.email, password: input.password },
    })
    if (!registered.success || !registered.authIdentity) {
      throw new Error("customer:test: the login could not be made")
    }
    identityId = registered.authIdentity.id
  }
  const identity = await auth.retrieveAuthIdentity(identityId)
  const linked = identity.app_metadata?.["customer_id"]
  let customerId = typeof linked === "string" ? linked : null
  const created = customerId === null
  if (customerId === null) {
    const { result } = await createCustomerAccountWorkflow(container).run({
      input: {
        authIdentityId: identityId,
        customerData: { email: input.email, first_name: "Test", last_name: "Müşteri" },
      },
    })
    customerId = result.id
  }
  await confirmAddress(container, identityId, input.email)
  return { customer_id: customerId, created }
}
