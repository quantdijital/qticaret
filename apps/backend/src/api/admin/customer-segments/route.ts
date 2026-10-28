import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CUSTOMER_SEGMENTS_MODULE } from "../../../modules/customer-segments"
import type CustomerSegmentsModuleService from "../../../modules/customer-segments/service"
import {
  createSegmentWorkflow,
  refreshSegmentWorkflow,
} from "../../../workflows/customers/segments"
import type { AdminPostCustomerSegmentType } from "./validators"
import { segmentView } from "./view"

/** GET /admin/customer-segments (F10.3): the shop's segments, by name. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const segments = await req.scope
    .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
    .listCustomerSegments({}, { order: { name: "ASC" }, take: 200 })
  res.json({ segments: segments.map(segmentView) })
}

/** POST /admin/customer-segments: a new segment with its group, filled at once. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCustomerSegmentType>,
  res: MedusaResponse
): Promise<void> {
  const { result: created } = await createSegmentWorkflow(req.scope).run({
    input: { ...req.validatedBody, created_by: req.auth_context.actor_id || null },
  })
  await refreshSegmentWorkflow(req.scope).run({ input: { segment_id: created.id } })
  const segment = await req.scope
    .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
    .retrieveCustomerSegment(created.id)
  res.status(201).json({ segment: segmentView(segment) })
}
