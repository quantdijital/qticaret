import type { MedusaContainer } from "@medusajs/framework/types"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import type { ConsentStatus } from "../../modules/messaging/types"

export interface ChannelFacts {
  consent: ConsentStatus | null
  suppressed: boolean
}

/**
 * Each address's commercial consent and suppression on the channel, read
 * in one go for a page of carts (adr/0036: the records hold keyed hashes).
 */
export async function channelFacts(
  container: Pick<MedusaContainer, "resolve">,
  channel: MessageChannel,
  addresses: (string | null)[]
): Promise<Map<string, ChannelFacts>> {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const hashes = new Map<string, string>()
  for (const address of addresses) {
    const recipient = address ? messaging.recipientOf(channel, address) : null
    if (address && recipient) {
      hashes.set(address, recipient.hash)
    }
  }
  const wanted = [...new Set(hashes.values())]
  const [consents, suppressions] =
    wanted.length === 0
      ? [[], []]
      : await Promise.all([
          messaging.listMessageConsents(
            { channel, recipient_hash: wanted },
            { select: ["recipient_hash", "status"], take: wanted.length }
          ),
          messaging.listMessageSuppressions(
            { channel, recipient_hash: wanted },
            { select: ["recipient_hash"], take: wanted.length }
          ),
        ])
  const status = new Map(consents.map((row) => [row.recipient_hash, row.status]))
  const held = new Set(suppressions.map((row) => row.recipient_hash))
  const facts = new Map<string, ChannelFacts>()
  for (const [address, hash] of hashes) {
    facts.set(address, { consent: status.get(hash) ?? null, suppressed: held.has(hash) })
  }
  return facts
}
