import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  callSearchStep,
  claimSearchStep,
  recordSearchUsageStep,
  releaseSearchStep,
  searchListsStep,
  searchServiceStep,
} from "./steps/search-intent"

export interface InterpretSearchInput {
  /** The shopper's sentence, as validated by the route (≤ 200 characters). */
  text: string
}

/**
 * A storefront sentence read into the search's filter (adr/0077 §7): the
 * shop's own key chosen, its lists read, one call claimed under the
 * storefront's ceiling, made and read against the lists (a filter or
 * nothing), the claim given back when the service never took it, and the
 * attempt recorded without its text. A failure is no error here: the
 * route searches the sentence as it is. Neither `store` nor a retention
 * may be turned on: the sentence must not be kept in `workflow_execution`.
 */
export const interpretSearchWorkflow = createWorkflow(
  "ai-interpret-search",
  (input: InterpretSearchInput) => {
    const chosen = searchServiceStep({})
    const lists = searchListsStep({})
    const claimed = claimSearchStep({})
    const outcome = callSearchStep(
      transform({ input, chosen, lists }, ({ input, chosen, lists }) => ({
        service: chosen.service,
        text: input.text,
        lists,
      }))
    )
    releaseSearchStep(
      transform({ claimed, outcome }, ({ claimed, outcome }) => ({ day: claimed.day, outcome }))
    )
    recordSearchUsageStep(
      transform({ chosen, outcome }, ({ chosen, outcome }) => ({
        service: chosen.service,
        funding: chosen.funding,
        outcome,
      }))
    )
    return new WorkflowResponse(
      transform({ lists, outcome }, ({ lists, outcome }) => ({
        lists,
        status: outcome.status,
        filter: outcome.filter,
        dropped: outcome.dropped,
      }))
    )
  }
)
