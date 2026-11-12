import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { codeSummary } from "@qticaret/server-kit"
import { billingIn, plansIn, tenantsIn } from "../../workflows/modules"
import { eachBounded } from "../fleet/bounded"
import { emailTransport } from "../mail/transport"
import type { OutgoingEmail } from "../mail/transport"
import { graceEndsOn, reminderKindFor } from "./rules"
import { reminderEmail } from "./reminder-mail"
import type { PaymentRow } from "../../modules/billing/service"

type Container = Pick<MedusaContainer, "resolve">

/** Sends one e-mail; the control plane's transport unless a caller (a test) gives its own. */
export type SendEmail = (email: OutgoingEmail) => Promise<void>

export interface ReminderTally {
  sent: number
  skipped: number
  failed: number
}

const PAGE = 500
const CONCURRENCY = 4

/** Every open charge, the overdue ones first, page by page. */
async function openCharges(container: Container, today: string): Promise<PaymentRow[]> {
  const rows: PaymentRow[] = []
  for (const view of ["overdue", "upcoming"] as const) {
    for (let offset = 0; ; offset += PAGE) {
      const page = await billingIn(container).payments({ view, today, limit: PAGE, offset })
      rows.push(...page.rows)
      if (page.rows.length < PAGE) {
        break
      }
    }
  }
  return rows
}

/**
 * The shops reminded (review L1): active or restricted ones only. A
 * suspended shop's charges keep their days (the run still advances them)
 * but no reminder goes: its storefront is closed and the e-mails' words
 * ("vitrininiz satışa devam ediyor") would be wrong; staff talk to a
 * suspended shop themselves. A shop being closed is not billed at all.
 */
async function remindedShops(container: Container, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set()
  }
  const shops = await tenantsIn(container).listTenants(
    { id: ids, status: ["active", "restricted"] },
    { select: ["id"], take: ids.length }
  )
  return new Set(shops.map((shop) => shop.id))
}

/** Who a shop's reminders go to: its primary billing contact, else its owner contact. */
async function recipientOf(container: Container, tenantId: string) {
  const contacts = await tenantsIn(container).contactsOf(tenantId)
  return (
    contacts.find((contact) => contact.is_primary_billing) ??
    contacts.find((contact) => contact.role === "owner") ??
    null
  )
}

/**
 * The day's payment reminders (adr/0061 §7, Ek C16): for each open charge
 * the one its schedule says today (`reminderKindFor`), claimed first in
 * the reminder table and sent only by the claim that went in: twice in a
 * day, or two processes at once, still one e-mail. The `restricted` one
 * goes only once the subscription is restricted; only active and
 * restricted shops are reminded (review L1). A reminder that cannot
 * go (no contact, e-mail off, the transport failed) stays claimed with
 * its reason: at most once, never twice. No address is logged.
 */
export async function sendReminders(
  container: Container,
  today: string,
  send?: SendEmail
): Promise<ReminderTally> {
  const tally: ReminderTally = { sent: 0, skipped: 0, failed: 0 }
  const billing = billingIn(container)
  const instruction = (await billing.paymentInstruction()).value
  const transport = send ?? emailTransport()?.send
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const charges = await openCharges(container, today)
  const reminded = await remindedShops(container, [
    ...new Set(charges.map((charge) => charge.tenant_id)),
  ])
  await eachBounded(charges, CONCURRENCY, async (charge) => {
    const kind = reminderKindFor(charge.due_on, charge.grace_days, today)
    if (
      !kind ||
      charge.amount <= 0 ||
      !reminded.has(charge.tenant_id) ||
      (kind === "restricted" && charge.subscription_status !== "restricted")
    ) {
      return
    }
    const claim = await billing.claimReminder(charge.id, charge.tenant_id, kind)
    if (!claim) {
      return
    }
    const contact = await recipientOf(container, charge.tenant_id)
    if (!contact || !transport) {
      await billing.noteReminder(
        claim,
        "skipped",
        contact ? "billing.mail_off" : "billing.no_contact"
      )
      tally.skipped += 1
      return
    }
    try {
      const [tenant, plan] = await Promise.all([
        tenantsIn(container).tenantOf(charge.tenant_id),
        plansIn(container).planOf(charge.tenant_id),
      ])
      await transport(
        reminderEmail(contact.email, {
          kind,
          shop: tenant.name,
          package: plan?.name ?? "",
          name: contact.name || null,
          due_on: charge.due_on,
          period_start: charge.period_start,
          period_end: charge.period_end,
          amount: charge.amount,
          grace_ends_on: graceEndsOn(charge.due_on, charge.grace_days),
          today,
          instruction,
        })
      )
      await billing.noteReminder(claim, "sent", null)
      tally.sent += 1
    } catch (error) {
      await billing.noteReminder(claim, "failed", "billing.mail_failed")
      tally.failed += 1
      logger.warn(
        `cp.billing_reminder_failed ${JSON.stringify({
          tenant_id: charge.tenant_id,
          charge_id: charge.id,
          kind,
          err: codeSummary(error),
        })}`
      )
    }
  })
  return tally
}
