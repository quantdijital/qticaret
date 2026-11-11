import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { addDays, istanbulDay } from "../../src/lib/billing/days"
import { runBilling } from "../../src/lib/billing/run"
import type { OutgoingEmail } from "../../src/lib/mail/transport"
import { BILLING_MODULE } from "../../src/modules/billing"
import type BillingModuleService from "../../src/modules/billing/service"
import { TENANTS_MODULE } from "../../src/modules/tenants"
import type TenantsModuleService from "../../src/modules/tenants/service"
import { client, freshSlug, makeTenant, proved } from "./tenants"
import type { HttpClient, Member } from "./staff"

export const billingOf = (container: MedusaContainer) =>
  container.resolve<BillingModuleService>(BILLING_MODULE)

/** An Istanbul day `n` days from the real today (the API marks payments on the real day). */
export const day = (n: number): string => addDays(istanbulDay(new Date()), n)

/** The instant an Istanbul day reaches `hour:minute` (UTC+3). */
export const at = (isoDay: string, hour = 10, minute = 0): Date =>
  new Date(Date.parse(`${isoDay}T00:00:00Z`) + ((hour - 3) * 60 + minute) * 60 * 1000)

/** E-mails a run would have sent, captured instead (tests never mail). */
export function mailbox() {
  const sent: OutgoingEmail[] = []
  return {
    sent,
    send: (email: OutgoingEmail) => {
      sent.push(email)
      return Promise.resolve()
    },
    to: (address: string) => sent.filter((email) => email.to === address),
  }
}

/** One run of billing at `now`, its e-mails into `box`. */
export const runAt = (container: MedusaContainer, now: Date, box: ReturnType<typeof mailbox>) =>
  runBilling(container, now, { send: box.send })

export interface BillingShop {
  id: string
  packageId: string
  /** The billing contact's address, unique to the test. */
  email: string
}

/**
 * An active shop on a fresh package (`trial_days`, `grace_days`, price)
 * with a billing contact: made through the API as staff do, then made
 * active as the setup would.
 */
export async function billingShop(
  http: HttpClient,
  container: MedusaContainer,
  members: { finance: Member; operator: Member },
  terms: { price?: number; trial_days?: number; grace_days?: number } = {}
): Promise<BillingShop> {
  const call = client(http)
  const made = await call.post(
    "/admin/cp/plans",
    {
      code: freshSlug("paket"),
      name: "Profesyonel Ağ",
      price: terms.price ?? 149_000,
      period: "monthly",
      trial_days: terms.trial_days ?? 0,
      grace_days: terms.grace_days ?? 7,
    },
    members.finance,
    await proved(http, members.finance)
  )
  const packageId = (made.data as { plan: { id: string } }).plan.id
  const tenant = await makeTenant(http, members.operator, { package_id: packageId })
  const tenants = container.resolve<TenantsModuleService>(TENANTS_MODULE)
  const email = `fatura-${randomUUID().slice(0, 8)}@ornekmagaza.com.tr`
  await tenants.saveContact(tenant.id, null, {
    name: "Selin Aydın",
    role: "billing",
    email,
    phone: null,
    is_primary_billing: true,
  })
  await tenants.changeStatus(tenant.id, "active", { reason_code: "provisioned", actor: "system" })
  return { id: tenant.id, packageId, email }
}

/** The shop's charges, oldest first. */
export async function chargesOf(container: MedusaContainer, tenantId: string) {
  const charges = await billingOf(container).chargesOf({ tenant_id: tenantId })
  return [...charges].sort((a, b) => a.due_on.localeCompare(b.due_on))
}
