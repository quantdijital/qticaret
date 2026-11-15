import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { desiredGroups, isEmptyMembershipPlan, membershipPlan } from "../../../lib/wholesale"
import type { MembershipPlan } from "../../../lib/wholesale"
import { CUSTOMER_SEGMENTS_MODULE } from "../../../modules/customer-segments"
import type CustomerSegmentsModuleService from "../../../modules/customer-segments/service"
import { accountById, wholesale } from "./account-rows"

type Container = Pick<MedusaContainer, "resolve">

/** The groups the customer is in now. */
async function groupsOf(container: Container, customerId: string): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["groups.id"],
    filters: { id: customerId },
  })
  const groups = (data[0] as { groups?: ({ id: string } | null)[] | null } | undefined)?.groups
  return (groups ?? []).flatMap((group) => (group ? [group.id] : []))
}

/** Every segment's group (adr/0037 §6). */
async function segmentGroups(container: Container): Promise<Set<string>> {
  const segments = await container
    .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
    .listCustomerSegments({}, { select: ["customer_group_id"], take: null })
  return new Set(segments.map((segment) => segment.customer_group_id))
}

/** Moves the customer in and out of groups as Medusa's customer module keeps them. */
async function apply(container: Container, customerId: string, plan: MembershipPlan) {
  const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const pairs = (ids: string[]) =>
    ids.map((customer_group_id) => ({ customer_id: customerId, customer_group_id }))
  if (plan.remove.length > 0) {
    await customers.removeCustomerFromGroup(pairs(plan.remove))
  }
  if (plan.add.length > 0) {
    await customers.addCustomerToGroup(pairs(plan.add))
  }
}

/**
 * The account's customer in exactly the groups its state asks for
 * (ADR-0068 §3): active, its level's and its own; pending or closed, no
 * wholesale group at all (retail at once). An active wholesaler leaves
 * the segments' groups too. Reads the account as it stands, so any step
 * before it (a new level, an own list opened, a state changed) is
 * followed. Undone by the opposite moves.
 */
export const syncMembershipsStep = createStep(
  "wholesale-sync-memberships",
  async (input: { account_id: string }, { container }) => {
    const account = await accountById(container, input.account_id)
    const customerId = account.customer_id ?? null
    if (!customerId) {
      return new StepResponse({ added: 0, removed: 0 }, null)
    }
    const [tier] = account.tier_id
      ? await wholesale(container).listWholesaleTiers(
          { id: account.tier_id },
          { select: ["customer_group_id"], take: 1 }
        )
      : []
    const [current, owned, segments] = await Promise.all([
      groupsOf(container, customerId),
      wholesale(container).ownedIds(),
      segmentGroups(container),
    ])
    const plan = membershipPlan({
      current,
      wholesale: owned.groupIds,
      segments,
      desired: desiredGroups({
        status: account.status,
        tierGroupId: tier?.customer_group_id ?? null,
        privateGroupId: account.private_group_id ?? null,
      }),
    })
    if (isEmptyMembershipPlan(plan)) {
      return new StepResponse({ added: 0, removed: 0 }, null)
    }
    await apply(container, customerId, plan)
    return new StepResponse(
      { added: plan.add.length, removed: plan.remove.length },
      { customer_id: customerId, plan }
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await apply(container, undo.customer_id, { add: undo.plan.remove, remove: undo.plan.add })
    }
  }
)
