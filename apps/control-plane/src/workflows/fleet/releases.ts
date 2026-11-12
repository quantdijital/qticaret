import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { TargetBefore } from "../../modules/fleet/service-releases"
import { fleetIn } from "../modules"
import { undoableStep } from "../undoable"

export interface AddReleaseInput {
  version: string
  commit: string
  notes: string | null
  created_by: string
}

const addReleaseStep = undoableStep(
  "cp-release-add",
  async (input: AddReleaseInput, container) => {
    const made = await fleetIn(container).addRelease(input)
    return { output: made, undo: made.id }
  },
  async (id: string, container) => {
    await fleetIn(container).removeRelease(id)
  }
)

/** A new release (Ek C18): 409 `cp.release_version_taken` for a known version. */
export const addReleaseWorkflow = createWorkflow(
  { name: "cp-release-add", store: false },
  (input: WorkflowData<AddReleaseInput>) => new WorkflowResponse(addReleaseStep(input))
)

const releaseNotesStep = undoableStep(
  "cp-release-notes",
  async (input: { id: string; notes: string | null }, container) => {
    const before = await fleetIn(container).setReleaseNotes(input.id, input.notes)
    return { output: { before }, undo: { id: input.id, notes: before } }
  },
  async (undo: { id: string; notes: string | null }, container) => {
    await fleetIn(container).setReleaseNotes(undo.id, undo.notes)
  }
)

/** A release's note (the only part of a release that changes); the note before comes back. */
export const setReleaseNotesWorkflow = createWorkflow(
  { name: "cp-release-notes", store: false },
  (input: WorkflowData<{ id: string; notes: string | null }>) =>
    new WorkflowResponse(releaseNotesStep(input))
)

export interface SetTargetInput {
  tenant_id: string
  release_id: string | null
  actor: string
  reason: string
}

const setTargetStep = undoableStep(
  "cp-tenant-target-release",
  async (input: SetTargetInput, container) => {
    const before = await fleetIn(container).setTarget(input)
    return { output: before, undo: before }
  },
  async (before: TargetBefore, container) => {
    await fleetIn(container).restoreTarget(before)
  }
)

/**
 * A shop's target release set or cleared (Ek C18): intent only, nothing
 * upgrades the shop (F16.6). What it was comes back for the audit.
 */
export const setTargetReleaseWorkflow = createWorkflow(
  { name: "cp-tenant-target-release", store: false },
  (input: WorkflowData<SetTargetInput>) => new WorkflowResponse(setTargetStep(input))
)
