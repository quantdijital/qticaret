import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { provisioner } from "../../lib/provisioning/provider"
import { provisionStep } from "./step"
import type { RunInput } from "./step"
import {
  activateStep,
  apiUrlStep,
  healthStep,
  ownerInviteStep,
  planDocumentStep,
  resendInviteStep,
  startStep,
} from "./steps-launch"
import { allocateStep, bootstrapStep, databaseStep, migrateStep, secretsStep } from "./steps-setup"
import { sectorPackStep } from "./steps-pack"
import { presetStep, profileStep } from "./steps-shop"
import { contextOf } from "./target"

/**
 * The provisioning workflows (adr/0061 §6.2, Ek C10). Each carries ids
 * only and keeps no record of itself (`store: false`): a shop's secrets
 * are made, written and dropped inside one step. The run and its steps
 * are recorded by the steps themselves (the `provisioning` module).
 */

/** The steps of each kind of run, in order: the run's page lists them before they start. */
export const RUN_STEPS = {
  create: [
    "allocate",
    "secrets",
    "database",
    "migrate",
    "bootstrap",
    "profile",
    "sector_pack",
    "preset",
    "plan_document",
    "start",
    "health",
    "api_url",
    "owner_invite",
    "activate",
  ],
  start: ["start", "health", "api_url"],
  stop: ["stop"],
  invite: ["resend_invite"],
  // C12: "Paketi yeniden uygula": the setup's own step, alone
  apply_pack: ["sector_pack"],
} as const

export type RunKind = keyof typeof RUN_STEPS

/** A shop set up, or set up again: every step skips what is there. */
export const provisionShopWorkflow = createWorkflow(
  { name: "cp-provisioning-create", store: false },
  (input: WorkflowData<RunInput>) => {
    allocateStep(input)
    secretsStep(input)
    databaseStep(input)
    migrateStep(input)
    bootstrapStep(input)
    profileStep(input)
    sectorPackStep(input)
    presetStep(input)
    planDocumentStep(input)
    startStep(input)
    healthStep(input)
    apiUrlStep(input)
    ownerInviteStep(input)
    activateStep(input)
    return new WorkflowResponse({ run_id: input.run_id })
  }
)

/** The shop's backend started again (its address stays): undone, stopped. */
export const startShopWorkflow = createWorkflow(
  { name: "cp-provisioning-start", store: false },
  (input: WorkflowData<RunInput>) => {
    startStep(input)
    healthStep(input)
    apiUrlStep(input)
    return new WorkflowResponse({ run_id: input.run_id })
  }
)

/** The shop's backend stopped: only a process the provisioner started for it. */
const stopStep = provisionStep("stop", async (input, container) => {
  const { target } = await contextOf(container, input.tenant_id)
  if (!(await provisioner().probe(target)).running) {
    return { status: "skipped", created: false, output: { running: false } }
  }
  await provisioner().stop(target)
  return { status: "succeeded", created: false, output: { running: false } }
})

export const stopShopWorkflow = createWorkflow(
  { name: "cp-provisioning-stop", store: false },
  (input: WorkflowData<RunInput>) => {
    stopStep(input)
    return new WorkflowResponse({ run_id: input.run_id })
  }
)

/** The owner's invitation sent again (a new link; the shop voids the old one). */
export const inviteOwnerWorkflow = createWorkflow(
  { name: "cp-provisioning-invite", store: false },
  (input: WorkflowData<RunInput>) => {
    resendInviteStep(input)
    return new WorkflowResponse({ run_id: input.run_id })
  }
)

/**
 * The shop's sector pack applied again (C12): the setup's step alone, on
 * a shop already set up. It only adds what the shop never had.
 */
export const applyPackWorkflow = createWorkflow(
  { name: "cp-provisioning-apply-pack", store: false },
  (input: WorkflowData<RunInput>) => {
    sectorPackStep(input)
    return new WorkflowResponse({ run_id: input.run_id })
  }
)

export const WORKFLOW_OF = {
  create: provisionShopWorkflow,
  start: startShopWorkflow,
  stop: stopShopWorkflow,
  invite: inviteOwnerWorkflow,
  apply_pack: applyPackWorkflow,
} as const
