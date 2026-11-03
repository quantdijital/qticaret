import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { kurus, subtractKurus } from "../../lib/money"
import { discountAmount, discountProblem, linesTotal } from "../../lib/payment-links/snapshot"
import type {
  DiscountType,
  PaymentLinkDiscount,
  PaymentLinkLine,
} from "../../lib/payment-links/snapshot"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { brandOf } from "../messaging/brand"
import { defaultChannel, liraRegion, priceLines, shortLines } from "./pricing"
import { paymentLinkSettings } from "./settings"

type Container = Pick<MedusaContainer, "resolve">

export interface PlanInput {
  actor_id: string
  customer_id: string | null
  lines: { variant_id: string; quantity: number }[]
  discount: { type: DiscountType; value: number; reason: string } | null
  shipping_option_id: string | null
}

/** A link as it would be made now: priced by the catalog, its discount within the role's limit. */
export interface LinkPlan {
  region_id: string
  lines: PaymentLinkLine[]
  items_total: number
  discount: PaymentLinkDiscount | null
  total: number
  /** Variants short on the shelf now: staff are warned, the link is not refused (adr/0051 §6). */
  short_variant_ids: string[]
}

async function assertCustomer(container: Container, customerId: string): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id"],
    filters: { id: customerId },
  })
  if (data.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "payment_link.customer_unknown")
  }
}

async function assertShippingOption(container: Container, optionId: string): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: ["id"],
    filters: { id: optionId },
  })
  if (data.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "payment_link.shipping_option_unknown")
  }
}

/**
 * What a link would offer (adr/0051 §2): the shop has a storefront to open
 * it on, every line has a catalog price in lira, and the discount is one
 * the staff member's role may give (an admin's limit is the owner's
 * setting). Shared by the preview and the making.
 */
export async function planPaymentLink(container: Container, input: PlanInput): Promise<LinkPlan> {
  if (!(await brandOf(container)).storefrontUrl) {
    throw new ValidationError("payment_link.no_storefront")
  }
  if (input.customer_id) {
    await assertCustomer(container, input.customer_id)
  }
  if (input.shipping_option_id) {
    await assertShippingOption(container, input.shipping_option_id)
  }
  const region = await liraRegion(container)
  const lines = await priceLines(container, input.lines, {
    region_id: region,
    customer_id: input.customer_id,
  })
  const itemsTotal = linesTotal(lines)
  let discount: PaymentLinkDiscount | null = null
  if (input.discount) {
    const [role, settings] = await Promise.all([
      container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(input.actor_id),
      paymentLinkSettings(container),
    ])
    const problem = discountProblem(
      role,
      input.discount,
      itemsTotal,
      settings.admin_max_discount_percent
    )
    if (problem === "payment_link.discount_invalid") {
      throw new ValidationError(problem, { field: "discount" })
    }
    if (problem) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, problem)
    }
    discount = {
      type: input.discount.type,
      value: input.discount.value,
      amount: discountAmount(input.discount.type, input.discount.value, itemsTotal),
      reason: input.discount.reason,
    }
  }
  const short = await shortLines(container, lines, await defaultChannel(container)).catch(
    () => new Set<string>()
  )
  return {
    region_id: region,
    lines,
    items_total: itemsTotal,
    discount,
    total: subtractKurus(itemsTotal, kurus(discount?.amount ?? 0)),
    short_variant_ids: [...short],
  }
}
