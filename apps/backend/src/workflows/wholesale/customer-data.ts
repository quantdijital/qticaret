import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { normalizeEmail } from "../../lib/wholesale"
import { wholesaleOrders } from "./orders"
import { wholesale } from "./steps/account-rows"

/**
 * A customer's wholesale record for their KVKK copy (ADR-0068 §10,
 * adr/0041 §6), as `docs/kvkk-envanter.md` lists it: whether they are or
 * were a wholesaler, under which company, their level, whether staff set
 * their sign-in's password, the dates, and which of their orders were
 * wholesale orders. Their tax identity is the invoice profile's, in the
 * copy's own section. Prices are the shop's, not theirs: the list's rows
 * are not copied. Staff ids stay out (who did it is the shop's record).
 */

type Container = Pick<MedusaContainer, "resolve">

const iso = (value: Date | string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null

const STATUS: Record<string, string> = {
  pending: "bekliyor",
  active: "etkin",
  inactive: "kapalı",
}

interface AccountRow {
  id: string
  customer_id: string | null
  email: string | null
  company_name: string | null
  contact_name: string | null
  tier_id: string | null
  private_price_list_id: string | null
  min_quantity: number | null
  staff_login: boolean
  status: string
  invited_at: Date | string | null
  activated_at: Date | string | null
  deactivated_at: Date | string | null
  created_at: Date | string
  deleted_at: Date | string | null
}

/**
 * Their wholesale accounts (one now; deleted ones kept for the order list
 * too, and an invitation pending to one of their addresses), each with
 * the order numbers it placed among `orderIds`. Empty: never a wholesaler.
 */
export async function wholesaleDataFor(
  container: Container,
  customerId: string,
  addresses: string[],
  orderIds: string[]
) {
  const service = wholesale(container)
  const emails = [...new Set(addresses.filter(Boolean).map(normalizeEmail))]
  // The same records the erasure takes (`legal/erasure/wholesale.ts`): theirs, deleted ones too,
  // and an old invitation still pending to their address
  const [own, invited] = await Promise.all([
    service.listWholesaleAccounts({ customer_id: customerId }, { take: null, withDeleted: true }),
    emails.length
      ? service.listWholesaleAccounts({ email: emails, status: "pending" }, { take: null })
      : [],
  ])
  const accounts = [
    ...new Map([...own, ...invited].map((account) => [account.id, account])).values(),
  ] as unknown as AccountRow[]
  if (accounts.length === 0) {
    return []
  }
  const tierIds = [...new Set(accounts.flatMap((account) => account.tier_id ?? []))]
  const tiers = tierIds.length
    ? await service.listWholesaleTiers(
        { id: tierIds },
        { select: ["id", "name"], take: null, withDeleted: true }
      )
    : []
  const tierName = new Map(tiers.map((tier) => [tier.id, tier.name]))
  const placed = await wholesaleOrders(container, { order_ids: orderIds })
  const numbers = await orderNumbers(container, [...placed.keys()])
  return accounts.map((account) => ({
    durum: account.deleted_at ? "silindi" : (STATUS[account.status] ?? account.status),
    firma_adı: account.company_name,
    // Only an old pending invitation keeps these; once active the customer record holds them
    yetkili_adı: account.contact_name,
    e_posta: account.email,
    seviye: account.tier_id ? (tierName.get(account.tier_id) ?? null) : null,
    özel_fiyat_listesi: account.private_price_list_id !== null,
    en_az_adet: account.min_quantity,
    giriş_şifresini_personel_belirledi: account.staff_login,
    açılış: iso(account.created_at),
    davet: iso(account.invited_at),
    etkinleşme: iso(account.activated_at),
    kapanma: iso(account.deactivated_at),
    silinme: iso(account.deleted_at),
    toptan_siparişler: [...placed]
      .filter(([, accountId]) => accountId === account.id)
      .flatMap(([orderId]) => numbers.get(orderId) ?? []),
  }))
}

/** The orders' numbers as the customer sees them (`display_id`). */
async function orderNumbers(container: Container, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: ids },
  })
  return new Map(
    (data as { id: string; display_id: number | string }[]).map((row) => [
      row.id,
      Number(row.display_id),
    ])
  )
}
