import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { checkTrAddressVersionStep } from "./steps/check-tr-address-version"

export type { TrAddressVersionCheck } from "./steps/check-tr-address-version"

/**
 * Whether TürkiyeAPI has a dataset the shop does not (adr/0008 Ek
 * 2026-11-04): one `/meta` read against the newest import. The weekly
 * check runs this and queues a sync only when it says so, so the jobs
 * list does not fill with runs that found nothing.
 */
export const checkTrAddressVersionWorkflow = createWorkflow(
  "tr-address-check-version",
  () =>
    new WorkflowResponse(
      checkTrAddressVersionStep({ source: "turkiyeapi", only_if_changed: true, actor_id: null })
    )
)
