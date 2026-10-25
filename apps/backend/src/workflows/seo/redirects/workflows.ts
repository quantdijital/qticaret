import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { forgetResolutionsStep } from "../steps/forget-resolutions"
import { deleteRedirectsStep } from "./steps/delete-redirects"
import { importRedirectsStep } from "./steps/import-redirects"
import type { ImportRedirectsInput } from "./steps/import-redirects"
import { planRedirectStep } from "./steps/plan-redirect"
import type { UpsertRedirectInput } from "./steps/plan-redirect"
import { releasePathStep } from "./steps/release-path"
import { writeRedirectStep } from "./steps/write-redirect"

// One lock for the whole rule set: two saves at once could each pass the
// loop check and close a loop together (A→B and B→A)
const RULES_LOCK = { key: "seo:redirects", timeout: 30, ttl: 120 }
// A thousand rows, each checked against the shop, outlast a single save
const IMPORT_LOCK = { ...RULES_LOCK, ttl: 600 }

/**
 * Saves a redirect rule (adr/0017): checked, stored flat, and the rules
 * that led to its source sent to its target. Every write is undone if a
 * later step fails.
 */
export const upsertRedirectWorkflow = createWorkflow(
  "seo-upsert-redirect",
  (input: UpsertRedirectInput) => {
    acquireLockStep(RULES_LOCK)
    const plan = planRedirectStep(input)
    const written = writeRedirectStep(plan)
    releaseLockStep({ key: RULES_LOCK.key })
    return new WorkflowResponse(written)
  }
)

export const deleteRedirectsWorkflow = createWorkflow("seo-delete-redirects", (ids: string[]) => {
  acquireLockStep(RULES_LOCK)
  const deleted = deleteRedirectsStep(ids)
  releaseLockStep({ key: RULES_LOCK.key })
  return new WorkflowResponse(deleted)
})

/** A redirect file, all rows or none; a dry run only reports. */
export const importRedirectsWorkflow = createWorkflow(
  "seo-import-redirects",
  (input: ImportRedirectsInput) => {
    acquireLockStep(IMPORT_LOCK)
    const result = importRedirectsStep(input)
    releaseLockStep({ key: RULES_LOCK.key })
    return new WorkflowResponse(result)
  }
)

export const releasePathWorkflow = createWorkflow("seo-release-path", (input: { path: string }) => {
  const released = releasePathStep(input)
  forgetResolutionsStep()
  return new WorkflowResponse(released)
})
