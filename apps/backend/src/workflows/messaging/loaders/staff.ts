import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { inviteLink } from "../../../lib/staff"
import type {
  StaffInviteVars,
  StaffOrderVars,
  StaffSeoVars,
  StaffStockVars,
} from "../../../lib/messaging/templates"
import { SEO_ADVISOR_MODULE } from "../../../modules/seo-advisor"
import type SeoAdvisorModuleService from "../../../modules/seo-advisor/service"
import { loadOrderMessage } from "./order"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">

// Staff alerts go to the staff list the send reads: the loader names no recipient
const STAFF = { recipients: {}, receiverId: null }

/** An order as its staff alert shows it. */
export async function loadStaffOrder(
  container: Container,
  orderId: string
): Promise<Loaded<StaffOrderVars> | null> {
  const order = await loadOrderMessage(container, orderId)
  if (!order) {
    return null
  }
  const { vars } = order
  return {
    vars: {
      number: vars.number,
      customer: vars.address[0] ?? vars.customerName,
      total: vars.total,
      payment: vars.payment,
      items: vars.items.reduce((total, item) => total + item.quantity, 0),
    },
    ...STAFF,
    resourceType: "order",
  }
}

/** A stock item running low, as the bell's alert saw it (its numbers come with the send). */
export function loadStaffStock(
  _container: Container,
  _itemId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<StaffStockVars> | null> {
  const available = Number(extra["available"])
  const threshold = Number(extra["threshold"])
  return Promise.resolve(
    extra["name"] && Number.isFinite(available) && Number.isFinite(threshold)
      ? {
          vars: { name: extra["name"], available, threshold },
          ...STAFF,
          resourceType: "inventory_item",
        }
      : null
  )
}

const LOWEST = 5

/** The shop's SEO this week (docs/14 §5): products' average score and the five lowest. */
export async function loadSeoDigest(container: Container): Promise<Loaded<StaffSeoVars> | null> {
  const rows = await container
    .resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
    .listSeoAssessments(
      { entity_type: "product" },
      {
        select: ["entity_id", "score", "grade", "critical"],
        order: { score: "ASC", entity_id: "ASC" },
      }
    )
  if (rows.length === 0) {
    return null
  }
  const lowest = rows.slice(0, LOWEST)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "title"],
    filters: { id: lowest.map((row) => row.entity_id) },
  })
  const titles = new Map(
    (data as { id: string; title: string }[]).map((row) => [row.id, row.title])
  )
  return {
    vars: {
      products: rows.length,
      average: Math.round(rows.reduce((total, row) => total + row.score, 0) / rows.length),
      critical: rows.filter((row) => row.critical > 0).length,
      poor: rows.filter((row) => row.grade === "poor").length,
      lowest: lowest.flatMap((row) => {
        const title = titles.get(row.entity_id)
        return title ? [{ title, score: row.score }] : []
      }),
    },
    ...STAFF,
    resourceType: "seo_digest",
  }
}

const INVITE_ROLES = new Set(["admin", "operations", "readonly"])

/**
 * An invitation (F12.6, adr/0040): to the invited address, a link to the
 * panel's page with the token only the invitation knew.
 */
export function loadStaffInvite(
  _container: Container,
  _inviteId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<StaffInviteVars> | null> {
  const { email, token, role = "" } = extra
  if (!email || !token || !INVITE_ROLES.has(role)) {
    return Promise.resolve(null)
  }
  return Promise.resolve({
    vars: {
      inviteUrl: inviteLink(token),
      role: role as StaffInviteVars["role"],
    },
    recipients: { email },
    receiverId: null,
    resourceType: "invite",
  })
}
