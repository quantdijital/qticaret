import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import type { RefreshScope } from "../../lib/storefront/refresh"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"
import {
  checkPopupStep,
  createPopupStep,
  deletePopupStep,
  setPopupActiveStep,
  updatePopupStep,
} from "./steps"
import type { SavePopupInput } from "./steps"

export type { PopupChanges, SavePopupInput } from "./steps"

// The storefront keeps `GET /store/popups` with its shop-wide answers (adr/0080 §5)
const SETTINGS: RefreshScope[] = ["settings"]

const lockOf = (id: string) => ({ key: `popups:${id}`, timeout: 10, ttl: 30 })

/** A new pop-up (adr/0080): checked as a whole, written; the storefront forgets its list. */
export const createPopupWorkflow = createWorkflow(
  "popups-create",
  (input: Omit<SavePopupInput, "id">) => {
    const values = checkPopupStep(input)
    const created = createPopupStep(values)
    refreshStorefrontStep(transform({}, () => SETTINGS))
    return new WorkflowResponse(created)
  }
)

/**
 * A change: fields left out keep their values; the record is checked as
 * it would be after the change. One save per pop-up at a time.
 */
export const updatePopupWorkflow = createWorkflow(
  "popups-update",
  (input: Required<SavePopupInput>) => {
    const lock = transform({ input }, ({ input }) => lockOf(input.id))
    acquireLockStep(lock)
    const values = checkPopupStep(input)
    const write = transform({ input, values }, ({ input, values }) => ({ id: input.id, values }))
    const updated = updatePopupStep(write)
    const key = transform({ lock }, ({ lock }) => ({ key: lock.key }))
    releaseLockStep(key)
    refreshStorefrontStep(transform({}, () => SETTINGS))
    return new WorkflowResponse(updated)
  }
)

/** The list's switch: on or off, nothing else changes. */
export const setPopupActiveWorkflow = createWorkflow(
  "popups-set-active",
  (input: { id: string; is_active: boolean }) => {
    const set = setPopupActiveStep(input)
    refreshStorefrontStep(transform({}, () => SETTINGS))
    return new WorkflowResponse(set)
  }
)

/** Deletes a pop-up; it leaves the storefront at once. */
export const deletePopupWorkflow = createWorkflow("popups-delete", (id: string) => {
  const deleted = deletePopupStep(id)
  refreshStorefrontStep(transform({}, () => SETTINGS))
  return new WorkflowResponse(deleted)
})
