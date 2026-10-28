import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { MARKETING_FEEDS_MODULE } from "../../modules/marketing-feeds"
import type MarketingFeedsModuleService from "../../modules/marketing-feeds/service"

/**
 * Turns the feeds on with a new token, or gives them a new one: the old
 * addresses stop working at once (adr/0038 §3). Nothing to undo; the
 * token is the shop's own.
 */
const issueFeedTokenStep = createStep(
  "marketing-issue-feed-token",
  async (_input: { by: string }, { container }) => {
    await container.resolve<MarketingFeedsModuleService>(MARKETING_FEEDS_MODULE).issueToken()
    return new StepResponse({ issued: true })
  }
)

export const issueFeedTokenWorkflow = createWorkflow(
  "marketing-issue-feed-token",
  (input: { by: string }) => new WorkflowResponse(issueFeedTokenStep(input))
)

/** Turns the feeds off: the token goes, and the files with it. */
const turnFeedsOffStep = createStep(
  "marketing-turn-feeds-off",
  async (_input: { by: string }, { container }) => {
    const feeds = container.resolve<MarketingFeedsModuleService>(MARKETING_FEEDS_MODULE)
    const access = await feeds.listFeedAccesses({}, { select: ["id"] })
    const files = await feeds.listFeedFiles({}, { select: ["id", "file_key"] })
    await feeds.deleteFeedAccesses(access.map(({ id }) => id))
    await feeds.deleteFeedFiles(files.map(({ id }) => id))
    if (files.length > 0) {
      await container.resolve(Modules.FILE).deleteFiles(files.map(({ file_key }) => file_key))
    }
    return new StepResponse({ removed: files.length })
  }
)

export const turnFeedsOffWorkflow = createWorkflow(
  "marketing-turn-feeds-off",
  (input: { by: string }) => new WorkflowResponse(turnFeedsOffStep(input))
)
