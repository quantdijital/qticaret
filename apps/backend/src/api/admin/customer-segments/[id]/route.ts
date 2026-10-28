import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CUSTOMER_SEGMENTS_MODULE } from "../../../../modules/customer-segments"
import type CustomerSegmentsModuleService from "../../../../modules/customer-segments/service"
import {
  deleteSegmentWorkflow,
  refreshSegmentWorkflow,
  updateSegmentWorkflow,
} from "../../../../workflows/customers/segments"
import type { AdminUpdateCustomerSegmentType } from "../validators"
import { segmentView } from "../view"

/** POST /admin/customer-segments/:id: renamed or new rules; the group is filled again. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateCustomerSegmentType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await updateSegmentWorkflow(req.scope).run({ input: { id, ...req.validatedBody } })
  await refreshSegmentWorkflow(req.scope).run({ input: { segment_id: id } })
  const segment = await req.scope
    .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
    .retrieveCustomerSegment(id)
  res.json({ segment: segmentView(segment) })
}

/** DELETE /admin/customer-segments/:id: the segment and its group. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await deleteSegmentWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "" },
  })
  res.json({ id: result.id, deleted: true })
}
