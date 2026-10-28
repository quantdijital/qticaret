import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { hashPii, parseKey } from "../../lib/crypto/pii"
import { parseEnv } from "../../lib/env"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type { ConsentEvidence } from "../../modules/messaging/service"
import type MessagingModuleService from "../../modules/messaging/service"

type Container = Pick<MedusaContainer, "resolve">

/** Where a customer's messages go: their e-mail, their phone. */
export async function customerAddresses(container: Container, customerId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["email", "phone"],
    filters: { id: customerId },
  })
  const customer = data[0] as { email: string | null; phone: string | null } | undefined
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "customers.unknown")
  }
  return { email: customer.email, sms: customer.phone }
}

/** The customer's answer on each channel, and whether they have an address there. */
export async function customerConsents(container: Container, customerId: string) {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const addresses = await customerAddresses(container, customerId)
  const read = (channel: "email" | "sms") => {
    const address = addresses[channel]
    return address ? messaging.consentRecordOf(channel, address) : Promise.resolve(null)
  }
  const [email, sms] = await Promise.all([read("email"), read("sms")])
  return {
    email: { address: addresses.email !== null, consent: email },
    sms: { address: addresses.sms !== null, consent: sms },
  }
}

/**
 * What a storefront consent is kept with (adr/0038 §2): the consent text's
 * version and a keyed hash of the IP it came from, never the IP itself.
 */
export function storefrontEvidence(
  ip: string,
  textVersion: string,
  more: ConsentEvidence = {}
): ConsentEvidence {
  const key = parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")
  return {
    text_version: textVersion,
    ...(ip ? { ip_hash: hashPii(ip, key, "messaging.ip").slice(0, 32) } : {}),
    ...more,
  }
}
