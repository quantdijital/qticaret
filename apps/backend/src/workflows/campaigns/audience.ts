import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { sortAudience } from "../../lib/campaigns/audience"
import type { Candidate, RecipientFacts, Sorted } from "../../lib/campaigns/audience"
import type { CampaignChannel, CampaignSource } from "../../lib/campaigns/types"
import { ValidationError } from "../../lib/errors"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { CUSTOMER_SEGMENTS_MODULE } from "../../modules/customer-segments"
import type CustomerSegmentsModuleService from "../../modules/customer-segments/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { MarketingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { activeWholesalers } from "../wholesale/marketing"

type Container = Pick<MedusaContainer, "resolve">

/** Rows read at a time. */
const PAGE = 1_000
const DAY_MS = 24 * 60 * 60 * 1000

interface ConsentRow {
  id: string
  recipient_hash: string
  customer_id: string | null
  status: "granted" | "revoked"
  iys_status: string
}

interface CustomerRow {
  id: string
  email: string | null
  phone: string | null
}

/** Every page of a list, read PAGE rows at a time. */
async function allPages<T>(read: (skip: number) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = []
  for (let skip = 0; ; skip += PAGE) {
    const page = await read(skip)
    rows.push(...page)
    if (page.length < PAGE) {
      return rows
    }
  }
}

/** The channel's granted consents by hash: only those can receive anything. */
async function grantedConsents(messaging: MessagingModuleService, channel: CampaignChannel) {
  const rows = (await allPages((skip) =>
    messaging.listMessageConsents(
      { channel, status: "granted" },
      {
        select: ["id", "recipient_hash", "customer_id", "status", "iys_status"],
        take: PAGE,
        skip,
        order: { id: "ASC" },
      }
    )
  )) as ConsentRow[]
  return new Map(rows.map((row) => [row.recipient_hash, row]))
}

async function suppressedHashes(messaging: MessagingModuleService, channel: CampaignChannel) {
  const rows = await allPages((skip) =>
    messaging.listMessageSuppressions(
      { channel },
      { select: ["recipient_hash"], take: PAGE, skip, order: { id: "ASC" } }
    )
  )
  return new Set(rows.map((row) => row.recipient_hash))
}

/** A segment's customers are its Medusa group's (adr/0037 §6). */
async function groupOf(container: Container, source: CampaignSource): Promise<string> {
  if (source.kind === "group") {
    return source.id
  }
  if (source.kind !== "segment") {
    throw new Error("campaigns: not a group source")
  }
  const [segment] = await container
    .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
    .listCustomerSegments({ id: source.id }, { take: 1, select: ["customer_group_id"] })
  if (!segment) {
    throw new ValidationError("campaigns.segment_unknown", { field: "audience" })
  }
  return segment.customer_group_id
}

async function customersOf(container: Container, groupId: string | null) {
  const customers = container.resolve(Modules.CUSTOMER)
  return (await allPages((skip) =>
    customers.listCustomers(groupId ? { groups: groupId } : {}, {
      select: ["id", "email", "phone"],
      take: PAGE,
      skip,
      order: { id: "ASC" },
    })
  )) as CustomerRow[]
}

export interface AudienceInput {
  channel: CampaignChannel
  sources: readonly CampaignSource[]
  /** The campaign itself: its own sends never count against the 24-hour rule. */
  campaign_id: string | null
  now?: Date
}

/**
 * Who the campaign reaches (adr/0050 §3): the sources' union, each person
 * once by keyed hash, less the suppressed, the unconsented, consents İYS
 * has not been told of and, with the shop's frequency cap, anyone another
 * campaign reached within 24 hours. Addresses are hashed here and never
 * leave this function. Active wholesalers are not in any audience at all
 * (ADR-0068 decision 16: the message shows retail prices and offers),
 * named by a source or not, under their customer record or a bare
 * newsletter consent at the same address.
 */
export async function resolveAudience(container: Container, input: AudienceInput): Promise<Sorted> {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const now = input.now ?? new Date()
  const marketing = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("marketing")) as unknown as MarketingSettings
  const [consents, suppressed, reached, wholesalers] = await Promise.all([
    grantedConsents(messaging, input.channel),
    suppressedHashes(messaging, input.channel),
    container
      .resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
      .reachedSince(new Date(now.getTime() - DAY_MS), input.campaign_id),
    activeWholesalers(container),
  ])
  const wholesaleHashes = new Set(
    (input.channel === "email" ? [...wholesalers.emails] : wholesalers.phones).flatMap(
      (address) => messaging.recipientOf(input.channel, address)?.hash ?? []
    )
  )
  const candidates: Candidate[] = []
  let invalid = 0
  const seen = new Set<string>()
  const addCustomer = (customer: CustomerRow, onlyConsented: boolean) => {
    const address = input.channel === "email" ? customer.email : customer.phone
    const recipient = address ? messaging.recipientOf(input.channel, address) : null
    // "All consented" names only those with consent: the rest are not in its audience at all
    if (seen.has(customer.id) || (onlyConsented && !(recipient && consents.has(recipient.hash)))) {
      return
    }
    if (
      wholesalers.customerIds.has(customer.id) ||
      (recipient && wholesaleHashes.has(recipient.hash))
    ) {
      return
    }
    seen.add(customer.id)
    if (!recipient) {
      invalid += 1
      return
    }
    candidates.push({
      hash: recipient.hash,
      source: "customer",
      source_id: customer.id,
      customer_id: customer.id,
    })
  }
  for (const source of input.sources) {
    if (source.kind === "segment" || source.kind === "group") {
      ;(await customersOf(container, await groupOf(container, source))).forEach((customer) => {
        addCustomer(customer, false)
      })
    } else if (source.kind === "all_consented") {
      ;(await customersOf(container, null)).forEach((customer) => {
        addCustomer(customer, true)
      })
    } else {
      // The newsletter's subscribers: consents without a customer record (adr/0050 §3)
      for (const consent of consents.values()) {
        if (consent.customer_id === null && !wholesaleHashes.has(consent.recipient_hash)) {
          candidates.push({
            hash: consent.recipient_hash,
            source: "consent",
            source_id: consent.id,
            customer_id: null,
          })
        }
      }
    }
  }
  const factsOf = (hash: string): RecipientFacts => {
    const consent = consents.get(hash)
    return {
      suppressed: suppressed.has(hash),
      consent: consent ? { status: consent.status, iys_status: consent.iys_status } : null,
      reachedLately: reached.has(hash),
    }
  }
  return sortAudience(candidates, invalid, factsOf, marketing.campaign_frequency_cap)
}
