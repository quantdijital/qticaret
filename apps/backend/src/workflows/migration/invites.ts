import type { MedusaContainer } from "@medusajs/framework/types"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { NotificationSettings } from "../../modules/platform-settings/sections/notifications"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { brandOf } from "../messaging/brand"
import { sendMessageWorkflow } from "../messaging/send-message"

type Container = Pick<MedusaContainer, "resolve">

/** The share of the shop's e-mails a day the invitations take at most: orders keep the rest. */
export const INVITE_SHARE = 0.5

const WAITING = { kind: "customer", invite_queued_at: { $ne: null }, invited_at: null }

const startOfDay = (now: Date) => new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`)

/** The invitations' queue: queued in all, told, still waiting, told today. */
export async function inviteStatus(container: Container, now: Date = new Date()) {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const count = async (filters: Record<string, unknown>) =>
    (await migration.listAndCountMigrationItems(filters, { take: 1, select: ["id"] }))[1]
  return {
    queued: await count({ kind: "customer", invite_queued_at: { $ne: null } }),
    invited: await count({ kind: "customer", invited_at: { $ne: null } }),
    waiting: await count(WAITING),
    today: await count({ kind: "customer", invited_at: { $gte: startOfDay(now) } }),
  }
}

export type InviteStop = "no_storefront" | "daily_share" | "over_quota" | "channel_off" | null

/**
 * Today's share of the queued invitations (F14.5, adr/0042 §6): the
 * shop's day split so orders always have their half, a stop when the
 * e-mail channel is off or the day is full. A send that failed waits for
 * the next day; one not to be sent (an account opened meanwhile, an
 * address that takes no mail) is done with. Nothing goes before the
 * storefront has an address to link to.
 */
export async function sendInvites(
  container: Container,
  now: Date = new Date()
): Promise<{ sent: number; stopped: InviteStop }> {
  if (!(await brandOf(container)).storefrontUrl) {
    return { sent: 0, stopped: "no_storefront" }
  }
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("notifications")) as unknown as NotificationSettings
  const share = Math.floor(settings.email_daily_limit * INVITE_SHARE)
  const allowance = share - (await inviteStatus(container, now)).today
  if (allowance <= 0) {
    return { sent: 0, stopped: "daily_share" }
  }
  const items = await migration.listMigrationItems(WAITING, {
    select: ["id", "target_id"],
    take: allowance,
    order: { id: "ASC" },
  })
  const done: string[] = []
  let sent = 0
  let stopped: InviteStop = null
  for (const item of items) {
    const { result } = await sendMessageWorkflow(container as MedusaContainer).run({
      input: {
        template: "account.migration_invite",
        resource_id: item.target_id ?? "",
        key: "migration",
      },
    })
    const outcome = (result as { email?: string }).email
    if (outcome === "over_quota" || outcome === "channel_off") {
      stopped = outcome
      break
    }
    if (outcome === "failed") {
      continue
    }
    sent += outcome === "sent" ? 1 : 0
    done.push(item.id)
  }
  if (done.length > 0) {
    await migration.updateMigrationItems(done.map((id) => ({ id, invited_at: now })))
  }
  return { sent, stopped }
}
