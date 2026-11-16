import type { ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { confirmedByOwnLogin } from "./proven-customer"

/** What whoever opened the account typed about the person; the address stays. */
const TYPED = ["first_name", "last_name", "phone", "company_name"] as const

type Details = Partial<Record<(typeof TYPED)[number], string | null>>

interface Undo {
  id: string
  before: Details
}

/**
 * The details typed into an account its login never confirmed, cleared
 * once its address's owner takes the login with the mailed reset link
 * (security review of PR #73, L4b). Someone who registered with a
 * stranger's address can open the account and type a name and a phone
 * of their choosing before anyone confirms the address; the owner, unable
 * to register again, resets the password and would inherit them (a phone
 * the order texts and the checkout would use). The reset is the only way
 * in to such an account (a social sign-in joins only a confirmed one), so
 * it is where they go. An owner who resets before confirming their own
 * registration types them again. Undone by writing them back.
 */
const clearStep = createStep(
  "account-clear-unconfirmed-details",
  async (input: { customer_id: string }, { container }) => {
    const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    const [customer] = await customers.listCustomers(
      { id: input.customer_id, has_account: true },
      { take: 1, select: ["id", ...TYPED] }
    )
    const nothing = new StepResponse<boolean, Undo | null>(false, null)
    if (!customer || (await confirmedByOwnLogin(container, input.customer_id))) {
      return nothing
    }
    const before: Details = Object.fromEntries(
      TYPED.map((field) => [field, customer[field] ?? null])
    )
    if (Object.values(before).every((value) => value === null)) {
      return nothing
    }
    await customers.updateCustomers(input.customer_id, {
      first_name: null,
      last_name: null,
      phone: null,
      company_name: null,
    })
    return new StepResponse<boolean, Undo | null>(true, { id: input.customer_id, before })
  },
  async (undo: Undo | null | undefined, { container }) => {
    if (undo) {
      await container
        .resolve<ICustomerModuleService>(Modules.CUSTOMER)
        .updateCustomers(undo.id, undo.before)
    }
  }
)

export const clearUnconfirmedDetailsWorkflow = createWorkflow(
  "account-clear-unconfirmed-details",
  (input: { customer_id: string }) => new WorkflowResponse(clearStep(input))
)
