import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { addressesOf, eraseCustomer } from "./erasure/customer"
import { eraseOrders } from "./erasure/orders"
import { eraseTraces } from "./erasure/traces"
import { closePrivacyRequestStep, openRequest } from "./privacy-requests"

// The steps hand each other the customer's id and counts, never their data:
// a run's steps are kept with it

const readErasureRequestStep = createStep(
  "legal-read-erasure-request",
  async (input: { request_id: string }, { container }) => {
    const request = await openRequest(container, input.request_id, "erasure")
    return new StepResponse({ customer_id: request.customer_id })
  }
)

const eraseTracesStep = createStep(
  "legal-erase-traces",
  async (input: { customer_id: string }, { container }) => {
    // Read first: the orders' and the profile's e-mails are erased after this step
    const addresses = await addressesOf(container, input.customer_id)
    return new StepResponse(await eraseTraces(container, input.customer_id, addresses))
  }
)

const eraseOrdersStep = createStep(
  "legal-erase-orders",
  async (input: { customer_id: string }, { container }) =>
    new StepResponse(await eraseOrders(container, input.customer_id, new Date()))
)

const eraseCustomerStep = createStep(
  "legal-erase-customer",
  async (input: { customer_id: string }, { container }) =>
    new StepResponse(await eraseCustomer(container, input.customer_id))
)

/**
 * A customer's erasure, as their KVKK request asks (F13.5, adr/0041 §6;
 * KK3): their traces, their orders' personal data, then the customer. The
 * books keep amounts, lines and tax; a contract keeps its copy while the
 * law does. Nothing is undone on a failure: putting the data back would
 * undo the request. Every step finds only what is left, so running the
 * request again finishes it; it stays open until then.
 */
export const eraseCustomerWorkflow = createWorkflow(
  "legal-erase-customer",
  (input: { request_id: string; by: string }) => {
    const request = readErasureRequestStep({ request_id: input.request_id })
    const traces = eraseTracesStep(request)
    const orders = eraseOrdersStep(request)
    const customer = eraseCustomerStep(request)
    closePrivacyRequestStep(
      transform({ input }, ({ input }) => ({
        request_id: input.request_id,
        status: "completed" as const,
        by: input.by,
      }))
    )
    return new WorkflowResponse(transform({ traces, orders, customer }, (results) => results))
  }
)
