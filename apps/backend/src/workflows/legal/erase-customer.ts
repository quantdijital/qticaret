import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../lib/errors"
import { addressesOf, eraseCustomer } from "./erasure/customer"
import { customerRecords, erasureBlocker } from "./erasure/guard"
import { eraseOrders } from "./erasure/orders"
import { eraseTraces } from "./erasure/traces"
import { closePrivacyRequestStep, openRequest } from "./privacy-requests"

// The steps hand each other the customers' ids and counts, never their data:
// a run's steps are kept with it

/**
 * The open erasure request, every record of the person it names (their
 * account and guest records under its e-mail), and nothing under way that
 * erasing would break.
 */
const readErasureRequestStep = createStep(
  "legal-read-erasure-request",
  async (input: { request_id: string }, { container }) => {
    const request = await openRequest(container, input.request_id, "erasure")
    const records = await customerRecords(container, request.customer_id)
    const blocker = await erasureBlocker(container, records, new Date())
    if (blocker) {
      throw new ConflictError(blocker)
    }
    return new StepResponse({ records })
  }
)

const eraseTracesStep = createStep(
  "legal-erase-traces",
  async (input: { records: string[] }, { container }) => {
    let carts = 0
    let messages = 0
    for (const customerId of input.records) {
      // Read first: the orders' and the profile's addresses are erased after this step
      const addresses = await addressesOf(container, customerId)
      const erased = await eraseTraces(container, customerId, addresses)
      carts += erased.carts
      messages += erased.messages
    }
    return new StepResponse({ carts, messages })
  }
)

const eraseOrdersStep = createStep(
  "legal-erase-orders",
  async (input: { records: string[] }, { container }) => {
    let orders = 0
    for (const customerId of input.records) {
      orders += (await eraseOrders(container, customerId, new Date())).orders
    }
    return new StepResponse({ orders })
  }
)

const eraseCustomerStep = createStep(
  "legal-erase-customer",
  async (input: { records: string[] }, { container }) => {
    for (const customerId of input.records) {
      await eraseCustomer(container, customerId)
    }
    return new StepResponse({ records: input.records.length })
  }
)

/**
 * A customer's erasure, as their KVKK request asks (F13.5, adr/0041 §6;
 * KK3): every record of theirs, refused while an order, a return or a
 * sale for the books is still under way. Their traces, their orders'
 * personal data, then the customer. The books keep amounts, lines and
 * tax; a contract keeps its copy while the law does. Nothing is undone on
 * a failure: putting the data back would undo the request. Every step
 * finds only what is left, so running the request again finishes it; it
 * stays open until then.
 */
export const eraseCustomerWorkflow = createWorkflow(
  "legal-erase-customer",
  (input: { request_id: string; by: string }) => {
    // One request handled at a time: an erasure and a refusal cannot cross
    const key = transform({ input }, ({ input }) => `privacy-request:${input.request_id}`)
    acquireLockStep({ key, timeout: 5, ttl: 300 })
    const request = readErasureRequestStep({ request_id: input.request_id })
    const traces = eraseTracesStep(request)
    const orders = eraseOrdersStep(request)
    const customer = eraseCustomerStep(request)
    closePrivacyRequestStep(
      transform({ input }, ({ input }) => ({
        request_id: input.request_id,
        status: "completed" as const,
        by: input.by,
        erasing: true,
      }))
    )
    releaseLockStep({ key })
    return new WorkflowResponse(transform({ traces, orders, customer }, (results) => results))
  }
)
