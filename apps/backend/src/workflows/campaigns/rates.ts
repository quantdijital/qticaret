import type { MedusaContainer } from "@medusajs/framework/types"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"

type Container = Pick<MedusaContainer, "resolve">

/** Reports read at most for one campaign: past this the campaign stopped long ago. */
const READ_MAX = 10_000

/**
 * The campaign's hard bounces and spam complaints (adr/0050 §6): what
 * Resend's webhook put on the suppression list since the campaign began
 * (api/hooks/resend), matched to the recipients it sent to by keyed hash.
 * Texts have no such reports.
 */
export async function reportedRates(
  container: Container,
  campaign: { id: string; channel: string; started_at: Date | string | null }
): Promise<{ bounces: number; complaints: number }> {
  if (campaign.channel !== "email" || !campaign.started_at) {
    return { bounces: 0, complaints: 0 }
  }
  const reports = await container
    .resolve<MessagingModuleService>(MESSAGING_MODULE)
    .listMessageSuppressions(
      {
        channel: "email",
        source: "resend",
        reason: ["bounce", "complaint"],
        created_at: { $gte: new Date(campaign.started_at) },
      },
      { select: ["recipient_hash", "reason"], take: READ_MAX }
    )
  if (reports.length === 0) {
    return { bounces: 0, complaints: 0 }
  }
  const ours = await container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE).sentAmong(
    campaign.id,
    reports.map((report) => report.recipient_hash)
  )
  const count = (reason: string) =>
    reports.filter((report) => report.reason === reason && ours.has(report.recipient_hash)).length
  return { bounces: count("bounce"), complaints: count("complaint") }
}
