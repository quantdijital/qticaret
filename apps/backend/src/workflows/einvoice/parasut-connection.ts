import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError, isProviderError } from "../../lib/errors"
import { createParasutOauth } from "../../lib/invoicing/parasut"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { parasutApiFor, requireParasutClient, withParasut } from "./parasut-session"

/**
 * The shop's Paraşüt company (F8, adr/0034 §5), connected by the owner
 * with the code Paraşüt's page showed them.
 */

export interface ConnectParasutInput {
  company_id: string
  /**
   * Good once and for minutes: spent in the step's first call, worthless
   * after, whatever the workflow keeps of its input.
   */
  code: string
  user_id: string
}

// Paraşüt's refusals of a code, or of a company the token does not reach
const REFUSED_CODE = new Set(["invalid_grant", "invalid_request", "unauthorized"])
const OTHER_COMPANY = new Set(["forbidden", "not_found"])

/**
 * Trades the code, checks the token reaches the company, and keeps the
 * pair. The last thing it does is the save: nothing after it can fail, so
 * there is nothing to undo; Paraşüt has no way to take a token back.
 * Only the company leaves the step: tokens never reach the workflow's
 * record.
 */
const connectParasutStep = createStep(
  "einvoice-connect-parasut",
  async (input: ConnectParasutInput, { container }) => {
    const client = requireParasutClient()
    let tokens
    try {
      tokens = await createParasutOauth().exchangeCode(client, input.code)
      await parasutApiFor(input.company_id).checkCompany(tokens.accessToken)
    } catch (error) {
      if (isProviderError(error) && REFUSED_CODE.has(error.providerCode)) {
        throw new ValidationError("einvoice.parasut_code_refused")
      }
      if (isProviderError(error) && OTHER_COMPANY.has(error.providerCode)) {
        throw new ValidationError("einvoice.parasut_company_refused")
      }
      throw error
    }
    await container
      .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      .saveParasutConnection({ company_id: input.company_id, tokens, by: input.user_id })
    return new StepResponse({ company_id: input.company_id })
  }
)

export const connectParasutWorkflow = createWorkflow(
  "einvoice-connect-parasut",
  (input: ConnectParasutInput) => new WorkflowResponse(connectParasutStep(input))
)

/**
 * Forgets the connection and its tokens for good. Not undone: the tokens
 * are not kept anywhere to put back; the owner connects again.
 */
const disconnectParasutStep = createStep(
  "einvoice-disconnect-parasut",
  async (_input: undefined, { container }) => {
    const removed = await container
      .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      .removeParasutConnection()
    return new StepResponse({ removed })
  }
)

export const disconnectParasutWorkflow = createWorkflow(
  "einvoice-disconnect-parasut",
  () => new WorkflowResponse(disconnectParasutStep())
)

/**
 * "Test the connection": a live token (refreshed if it died) and one read
 * of the company. Its outcome is kept for the panel; nothing to undo.
 */
const checkParasutStep = createStep(
  "einvoice-check-parasut",
  async (_input: undefined, { container }) => {
    const service = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    let code: string | null = null
    try {
      await withParasut(container, (api, token) => api.checkCompany(token))
    } catch (error) {
      if (isProviderError(error)) {
        code = error.providerCode
      } else if (error instanceof ValidationError) {
        return new StepResponse({ ok: false, code: error.safeMessage })
      } else {
        throw error
      }
    }
    await service.recordParasutCheck(code)
    return new StepResponse({ ok: code === null, code })
  }
)

export const checkParasutWorkflow = createWorkflow(
  "einvoice-check-parasut",
  () => new WorkflowResponse(checkParasutStep())
)
