import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  createCustomerGroupsWorkflow,
  deleteCustomerGroupsWorkflow,
  linkCustomersToCustomerGroupWorkflow,
  updateCustomerGroupsWorkflow,
} from "@medusajs/medusa/core-flows"
import { inSegment } from "../../lib/customers/segments"
import type { SegmentRules } from "../../lib/customers/segments"
import { CUSTOMER_SEGMENTS_MODULE } from "../../modules/customer-segments"
import type CustomerSegmentsModuleService from "../../modules/customer-segments/service"
import { activeWholesalers } from "../wholesale/accounts/wholesalers"
import { customerFacts } from "./segment-facts"

const loadSegmentStep = createStep(
  "customer-segments-load",
  async (input: { segment_id: string }, { container }) => {
    const segment = await container
      .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
      .retrieveCustomerSegment(input.segment_id)
    return new StepResponse({
      id: segment.id,
      rules: segment.rules as unknown as SegmentRules,
      customer_group_id: segment.customer_group_id,
    })
  }
)

/**
 * Who belongs now, and who is to join or leave the segment's group. An
 * active wholesaler never does (ADR-0068 Ek 2026-11-15 4): a list or a
 * promotion for the segment would tie with their level's and undercut
 * the wholesale price.
 */
const segmentChangesStep = createStep(
  "customer-segments-changes",
  async (input: { rules: SegmentRules; customer_group_id: string }, { container }) => {
    const now = new Date()
    const wholesalers = await activeWholesalers(container)
    const members = new Set(
      (await customerFacts(container, input.rules))
        .filter((facts) => inSegment(input.rules, facts, now) && !wholesalers.has(facts.id))
        .map(({ id }) => id)
    )
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "customer_group",
      fields: ["customers.id"],
      filters: { id: input.customer_group_id },
    })
    const current = new Set(
      ((data[0] as { customers?: ({ id: string } | null)[] } | undefined)?.customers ?? [])
        .filter((each) => each !== null)
        .map(({ id }) => id)
    )
    return new StepResponse({
      add: [...members].filter((id) => !current.has(id)),
      remove: [...current].filter((id) => !members.has(id)),
      count: members.size,
    })
  }
)

const recordRefreshStep = createStep(
  "customer-segments-record-refresh",
  async (input: { segment_id: string; count: number }, { container }) => {
    await container
      .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
      .updateCustomerSegments({
        id: input.segment_id,
        member_count: input.count,
        refreshed_at: new Date(),
      })
    return new StepResponse({ member_count: input.count })
  }
)

/**
 * Fills a segment's group with the customers its rules take now: those
 * who fit join, those who no longer fit leave. Medusa's own link workflow
 * moves them, and undoes itself if anything after it fails.
 */
export const refreshSegmentWorkflow = createWorkflow(
  "customer-segments-refresh",
  (input: { segment_id: string }) => {
    const segment = loadSegmentStep(input)
    const changes = segmentChangesStep(segment)
    linkCustomersToCustomerGroupWorkflow.runAsStep({
      input: transform(
        { segment, changes },
        ({ segment: { customer_group_id: id }, changes: diff }) => ({
          id,
          add: diff.add,
          remove: diff.remove,
        })
      ),
    })
    return new WorkflowResponse(
      recordRefreshStep(
        transform({ input, changes }, ({ input: { segment_id }, changes: { count } }) => ({
          segment_id,
          count,
        }))
      )
    )
  }
)

/** The segment's row next to its new group; undone by removing the row. */
const createSegmentRowStep = createStep(
  "customer-segments-create-row",
  async (
    input: { name: string; rules: SegmentRules; customer_group_id: string },
    { container }
  ) => {
    const created = await container
      .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
      .createCustomerSegments({
        name: input.name,
        rules: input.rules,
        customer_group_id: input.customer_group_id,
      })
    return new StepResponse(created, created.id)
  },
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
        .deleteCustomerSegments([id])
    }
  }
)

/** A new segment: its own Medusa group (marked as the segment's), then its row. */
export const createSegmentWorkflow = createWorkflow(
  "customer-segments-create",
  (input: { name: string; rules: SegmentRules; created_by: string | null }) => {
    const groups = createCustomerGroupsWorkflow.runAsStep({
      input: transform({ input }, ({ input: { name, created_by } }) => ({
        customersData: [
          { name, metadata: { managed_by: "segment" }, ...(created_by ? { created_by } : {}) },
        ],
      })),
    })
    return new WorkflowResponse(
      createSegmentRowStep(
        transform({ input, groups }, ({ input: { name, rules }, groups: created }) => ({
          name,
          rules,
          customer_group_id: created[0]?.id ?? "",
        }))
      )
    )
  }
)

const updateSegmentRowStep = createStep(
  "customer-segments-update-row",
  async (
    input: { id: string; name?: string | undefined; rules?: SegmentRules | undefined },
    { container }
  ) => {
    const segments = container.resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
    const before = await segments.retrieveCustomerSegment(input.id)
    const updated = await segments.updateCustomerSegments({
      id: input.id,
      ...(input.name ? { name: input.name } : {}),
      ...(input.rules ? { rules: input.rules } : {}),
    })
    return new StepResponse(updated, { id: before.id, name: before.name, rules: before.rules })
  },
  async (before, { container }) => {
    if (before) {
      await container
        .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
        .updateCustomerSegments(before)
    }
  }
)

/** A segment renamed or given new rules; its group follows the name. */
export const updateSegmentWorkflow = createWorkflow(
  "customer-segments-update",
  (input: { id: string; name?: string | undefined; rules?: SegmentRules | undefined }) => {
    const segment = updateSegmentRowStep(input)
    updateCustomerGroupsWorkflow.runAsStep({
      input: transform({ segment }, ({ segment: row }) => ({
        selector: { id: row.customer_group_id },
        update: { name: row.name },
      })),
    })
    return new WorkflowResponse(segment)
  }
)

const deleteSegmentRowStep = createStep(
  "customer-segments-delete-row",
  async (input: { id: string }, { container }) => {
    const segments = container.resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
    const segment = await segments.retrieveCustomerSegment(input.id)
    await segments.softDeleteCustomerSegments([input.id])
    return new StepResponse({ customer_group_id: segment.customer_group_id }, input.id)
  },
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
        .restoreCustomerSegments([id])
    }
  }
)

/** A segment gone, with its group: the promotions that targeted it no longer reach anyone through it. */
export const deleteSegmentWorkflow = createWorkflow(
  "customer-segments-delete",
  (input: { id: string }) => {
    const removed = deleteSegmentRowStep(input)
    deleteCustomerGroupsWorkflow.runAsStep({
      input: transform({ removed }, ({ removed: { customer_group_id } }) => ({
        ids: [customer_group_id],
      })),
    })
    return new WorkflowResponse({ id: input.id })
  }
)
