import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../lib/errors"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { isOpen } from "../../lib/payment-links/snapshot"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { deliver } from "../messaging/deliver"
import { loadPaymentLinkMessage } from "../messaging/loaders/payment-link"
import { linkById } from "./manage"

type Container = Pick<MedusaContainer, "resolve">

/** One send of a link in ten minutes (adr/0051 §7): an SMS costs the shop, a flood annoys. */
export const RESEND_GAP_MS = 10 * 60 * 1000

export interface SendPaymentLinkInput {
  id: string
  channels: MessageChannel[]
}

/**
 * Sends the link to its customer on the channels asked for, through
 * deliver(): suppression, the SMS account and the day's quota decide. Each
 * send is a new message (its own key); an e-mail cannot be called back, so
 * nothing is undone.
 */
const sendLinkStep = createStep(
  "payment-links-send",
  async (input: SendPaymentLinkInput, { container }) => {
    const link = await linkById(container, input.id)
    if (!isOpen(link)) {
      throw new ConflictError("payment_link.not_open")
    }
    if (link.last_sent_at && Date.now() - new Date(link.last_sent_at).getTime() < RESEND_GAP_MS) {
      throw new ConflictError("payment_link.sent_recently")
    }
    const loaded = await loadPaymentLinkMessage(container, link.id)
    if (!loaded) {
      throw new ConflictError("payment_link.not_open")
    }
    const recipients = Object.fromEntries(
      input.channels.map((channel) => [channel, loaded.recipients[channel] ?? null])
    )
    const outcomes = await deliver(container, {
      template: "payment_link.sent",
      resource: { type: "payment_link", id: link.id },
      recipients,
      receiverId: loaded.receiverId,
      vars: loaded.vars,
      key: String(link.sent_count + 1),
    })
    if (Object.values(outcomes).includes("sent")) {
      await container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE).updatePaymentLinks({
        id: link.id,
        sent_count: link.sent_count + 1,
        last_sent_at: new Date(),
      })
    }
    return new StepResponse(outcomes)
  }
)

export const sendPaymentLinkWorkflow = createWorkflow(
  "payment-links-send",
  (input: SendPaymentLinkInput) => new WorkflowResponse(sendLinkStep(input))
)

/** Which channels the link went out on, as Medusa recorded the sends. */
export async function sentChannels(
  container: Container,
  linkId: string
): Promise<{ email: boolean; sms: boolean }> {
  const notifications = container.resolve(Modules.NOTIFICATION) as unknown as {
    listNotifications: (
      filters: Record<string, unknown>,
      config: { select: string[]; take: number }
    ) => Promise<{ channel: string; status?: string | null }[]>
  }
  const rows = await notifications.listNotifications(
    { resource_id: linkId, template: "payment_link.sent" },
    { select: ["channel", "status"], take: 100 }
  )
  const went = (channel: string) =>
    rows.some((row) => row.channel === channel && row.status !== "failure")
  return { email: went("email"), sms: went("sms") }
}
