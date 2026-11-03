import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { normalizeRecipient } from "../../lib/messaging/recipients"
import { MESSAGE_TEMPLATES } from "../../lib/messaging/templates"
import { unsubscribePageUrl, unsubscribeUrl } from "../../lib/messaging/unsubscribe"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { brandOf } from "../messaging/brand"
import { withinQuota } from "../messaging/quota"
import { senderAddress } from "../messaging/sender-domain"
import { assertComplete } from "./content"
import { channelBlocker } from "./lifecycle"
import { personalise, prepareCampaign, renderCampaign } from "./prepare"
import { campaignOf } from "./save"

const template = MESSAGE_TEMPLATES["marketing.campaign"]

/**
 * A test send (adr/0050 §5): to the staff member who asks, never to an
 * address they type, or the shop's domain would send anyone a message of
 * their making. An e-mail goes to their own sign-in address; a text to the
 * shop's own number (Ayarlar > Mağaza bilgileri), staff having no phone of
 * record. Marked `[Deneme]`; no consent asked, the day's quota counted.
 * Sent outside deliver(), which asks for consent: nothing to undo.
 */
const testSendStep = createStep(
  "campaigns-test-send",
  async (input: { id: string; user_id: string }, { container }) => {
    const campaign = await campaignOf(container.resolve(CAMPAIGNS_MODULE), input.id)
    assertComplete(campaign)
    const blocker = await channelBlocker(container, campaign.channel)
    if (blocker) {
      throw new ValidationError(blocker)
    }
    const channel = campaign.channel
    const [user] = await container
      .resolve(Modules.USER)
      .listUsers({ id: input.user_id }, { select: ["email", "first_name"], take: 1 })
    const store = (await container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("store")) as unknown as StoreSettings
    const address = channel === "email" ? (user?.email ?? null) : store.contact_phone
    const to = address ? normalizeRecipient(channel, address) : null
    const recipient = to
      ? container.resolve<MessagingModuleService>(MESSAGING_MODULE).recipientOf(channel, to)
      : null
    if (!to || !recipient) {
      throw new ValidationError("campaigns.test_address_missing")
    }
    if (!(await withinQuota(container, channel, recipient.hash, template))) {
      throw new ValidationError("campaigns.quota_spent")
    }
    const [brand, prepared] = await Promise.all([
      brandOf(container),
      prepareCampaign(container, campaign),
    ])
    const vars = personalise(prepared, user?.first_name ?? null, true)
    const rendered = renderCampaign(
      channel,
      vars,
      brand,
      unsubscribePageUrl(recipient.hash, brand.storefrontUrl)
    )
    const content = rendered.channel === "email" ? rendered.email : { text: rendered.text }
    const leave = channel === "email" ? unsubscribeUrl(recipient.hash) : null
    await container.resolve(Modules.NOTIFICATION).createNotifications([
      {
        to,
        channel,
        template: template.name,
        data: { resource_type: "campaign", resource_id: campaign.id },
        content,
        provider_data:
          channel === "email"
            ? {
                from_email: await senderAddress(container),
                from_name: brand.shopName,
                reply_to: brand.contactEmail,
                ...(leave ? { list_unsubscribe: leave } : {}),
              }
            : { commercial: true },
        trigger_type: template.name,
        resource_type: "campaign",
        resource_id: campaign.id,
        receiver_id: null,
        // Each test its own send: a second one after an edit must go too
        idempotency_key: `${template.name}:${channel}:test:${campaign.id}:${randomUUID()}`,
      },
    ])
    return new StepResponse({ channel, to: recipient.masked })
  }
)

export const testSendCampaignWorkflow = createWorkflow(
  "campaigns-test-send",
  (input: { id: string; user_id: string }) => new WorkflowResponse(testSendStep(input))
)
