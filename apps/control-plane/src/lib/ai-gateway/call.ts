import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AI_TASK_CAPABILITIES, isAiCreditTask } from "@qticaret/types/control-plane"
import type { AiCreditCapability, AiGatewayRefusalCode } from "@qticaret/types/control-plane"
import { vaultIn } from "../../workflows/modules"
import { aiCreditSettingsOf } from "../ai-credits/platform-settings"
import { release, settle, spend } from "../ai-credits/spend"
import type { SpendResult } from "../ai-credits/spend"
import { PLATFORM_OWNER, aiProviderKeyName } from "../vault/secret-names"
import { prepareBody } from "./body"
import { mayEchoKey, passedOn, refusal } from "./errors"
import type { CreditNote, GatewayAnswer } from "./errors"
import { forwardCall, notTaken } from "./forward"
import { holdCallSlot } from "./in-flight"
import type { ForwardOutcome, ProviderFetch } from "./forward"
import { callParamsOf } from "./headers"
import { providerKeysHeld } from "./keys"
import { AI_PROVIDER_MAX_ANSWER_BYTES, AI_PROVIDER_TIMEOUT_MS } from "./limits"
import { measuresOf } from "./measures"
import { gatewayTargetOf } from "./target"
import type { GatewayTarget } from "./target"
import { platformCreditsOn } from "./tenant"

type Container = Pick<MedusaContainer, "resolve">

/**
 * `POST /tenant-api/v1/ai/calls` (adr/0085 §2): one provider call on the
 * platform's credits. Every call reads afresh the shop's status and flag,
 * the routing and whether its key is held; the signed target's query names a task,
 * a capability, a service and an operation, and the service is only
 * compared with the routing's, never chosen by it. The body is made safe
 * (body.ts), the credits are taken (or the operation's call counted),
 * the key is opened for this call alone, the provider asked at the
 * table's address. Then, before anything is answered and whatever the
 * shop's connection does meanwhile, the operation is closed: given back
 * when the provider never took the call (its first call only), kept with
 * its measures otherwise (a timeout too: the work may have been billed).
 * The log line holds the meta alone: no body, prompt, answer or key.
 */

export interface GatewayCallInput {
  tenantId: string
  /** The request target as signed (path and query): the call's values are its query's. */
  target: string
  raw: Buffer
  contentType: string
  /** Tests only: the provider's fetch. */
  fetch?: ProviderFetch
}

const SPEND_REFUSALS: Readonly<Record<string, AiGatewayRefusalCode>> = {
  not_offered: "not_offered",
  task_mismatch: "task_mismatch",
  exhausted: "credits_exhausted",
  daily_cap: "daily_cap",
  call_cap: "call_cap",
  // A closed or given back operation's id: no call joins it any more
  expired_operation: "call_cap",
  // Another server's clock is ahead: a passing refusal, tried again later
  clock_behind: "unavailable",
}

const balanceOf = (value: { plan: number; purchased: number }) => value.plan + value.purchased

interface Charge {
  result: Extract<SpendResult, { kind: "charged" | "repeat" }>
  note: CreditNote
}

/** The routed service's target for this call, or null: credits are not available for it. */
async function routedTarget(
  container: Container,
  service: string,
  capability: AiCreditCapability,
  task: Parameters<typeof gatewayTargetOf>[2]
): Promise<GatewayTarget | null> {
  const [settings, keys] = await Promise.all([
    aiCreditSettingsOf(container),
    providerKeysHeld(container),
  ])
  const route = settings.routing[capability]
  if (route?.service !== service || !keys.has(route.service)) {
    return null
  }
  return gatewayTargetOf(route.service, capability, task)
}

/** The provider asked with the key opened for this call only, zeroed once sent. */
async function askProvider(
  container: Container,
  target: GatewayTarget,
  prepared: { body: Buffer; contentType: string },
  capability: AiCreditCapability,
  fetch: ProviderFetch | undefined
): Promise<{ outcome: ForwardOutcome; echoes: boolean }> {
  let key: Buffer | null = null
  try {
    key = await vaultIn(container).openSecret(PLATFORM_OWNER, aiProviderKeyName(target.service))
    const outcome = await forwardCall({
      target,
      key,
      body: prepared.body,
      contentType: prepared.contentType,
      timeoutMs: target.timeoutMs ?? AI_PROVIDER_TIMEOUT_MS[capability],
      maxAnswerBytes: AI_PROVIDER_MAX_ANSWER_BYTES[capability],
      ...(fetch === undefined ? {} : { fetch }),
    })
    const echoes = outcome.kind === "answered" && mayEchoKey(outcome.status, outcome.body, key)
    return { outcome, echoes }
  } catch {
    // The key could not be opened (destroyed meanwhile): nothing was sent
    return { outcome: { kind: "not_connected", code: "no_key" }, echoes: false }
  } finally {
    key?.fill(0)
  }
}

/** Closes the operation for this call's outcome; the credit note the answer carries. */
async function closeOperation(
  container: Container,
  input: { tenantId: string; operationId: string; target: GatewayTarget; imagesSent: number },
  charge: Charge,
  outcome: ForwardOutcome
): Promise<CreditNote> {
  const { tenantId, operationId, target } = input
  const now = new Date()
  if (notTaken(outcome, target)) {
    if (charge.result.kind === "charged") {
      const back = await release(container, { tenantId, operationId, now })
      if (back.released) {
        return { charged: 0, balance: charge.note.balance + back.plan + back.purchased }
      }
    }
    return charge.note
  }
  const answered = outcome.kind === "answered" && outcome.status >= 200 && outcome.status < 300
  await settle(container, {
    tenantId,
    operationId,
    measures: answered
      ? measuresOf(target, outcome, input.imagesSent)
      : { service: target.service, model: target.model },
    now,
  })
  return charge.note
}

function answerOf(outcome: ForwardOutcome, echoes: boolean, note: CreditNote): GatewayAnswer {
  if (outcome.kind === "answered") {
    return echoes ? refusal("unavailable", note) : passedOn(outcome, note)
  }
  return refusal(outcome.kind === "timeout" ? "provider_timeout" : "provider_unreachable", note)
}

type Note = (fields: Record<string, unknown>) => void

/** The call, its slot held (`gatewayCall`). */
async function heldCall(
  container: Container,
  input: GatewayCallInput,
  note: Note
): Promise<GatewayAnswer> {
  const { tenantId } = input
  if (!(await platformCreditsOn(container, tenantId, new Date()))) {
    note({ refused: "unavailable", reason: "flag_or_status" })
    return refusal("unavailable")
  }
  const params = callParamsOf(input.target)
  if (params === null) {
    note({ refused: "body_refused", reason: "params" })
    return refusal("body_refused")
  }
  const { task, capability: capabilityName, service, operation: operationId } = params
  const meta = { task, capability: capabilityName, service }
  if (!isAiCreditTask(task)) {
    note({ ...meta, refused: "not_offered" })
    return refusal("not_offered")
  }
  const capability = capabilityName as AiCreditCapability
  if (!(AI_TASK_CAPABILITIES[task] as readonly string[]).includes(capabilityName)) {
    note({ ...meta, refused: "task_mismatch" })
    return refusal("task_mismatch")
  }
  const target = await routedTarget(container, service, capability, task)
  if (target === null) {
    note({ ...meta, refused: "unavailable", reason: "routing" })
    return refusal("unavailable")
  }
  const prepared = prepareBody({
    raw: input.raw,
    contentType: input.contentType,
    task,
    capability,
    target,
  })
  if (!prepared.ok) {
    note({ ...meta, refused: prepared.code, reason: prepared.reason })
    return refusal(prepared.code)
  }

  const spent = await spend(container, { tenantId, operationId, task, capability, now: new Date() })
  if (spent.kind !== "charged" && spent.kind !== "repeat") {
    const code = SPEND_REFUSALS[spent.kind] ?? "unavailable"
    note({ ...meta, refused: code })
    return refusal(code)
  }
  const charge: Charge = {
    result: spent,
    note: {
      charged: spent.kind === "charged" ? spent.credits : 0,
      balance: balanceOf(spent.balance),
    },
  }
  const { outcome, echoes } = await askProvider(
    container,
    target,
    prepared,
    capability,
    input.fetch
  )
  const credit = await closeOperation(
    container,
    { tenantId, operationId, target, imagesSent: prepared.images },
    charge,
    outcome
  )
  note({
    ...meta,
    call: spent.kind,
    outcome: outcome.kind === "answered" ? outcome.status : outcome.code,
    charged: credit.charged,
  })
  return answerOf(outcome, echoes, credit)
}

/**
 * One call, in one of the shop's slots (in-flight.ts): past its four (or
 * the process's 32) it is refused `busy` before anything is read or
 * charged; the slot is given back however the call ends.
 */
export async function gatewayCall(
  container: Container,
  input: GatewayCallInput
): Promise<GatewayAnswer> {
  const started = Date.now()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const note: Note = (fields) => {
    logger.info(
      `cp.ai_gateway_call ${JSON.stringify({ tenant_id: input.tenantId, ms: Date.now() - started, ...fields })}`
    )
  }
  const giveBack = holdCallSlot(input.tenantId)
  if (giveBack === null) {
    note({ refused: "busy" })
    return refusal("busy")
  }
  try {
    return await heldCall(container, input, note)
  } finally {
    giveBack()
  }
}
