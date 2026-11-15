import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { likeLiteral } from "../../lib/db/like"
import { confirmedByOwnLogin } from "./proven-customer"

export interface LinkedCustomer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  has_account: true
}

interface LinkInput {
  auth_identity_id: string
  app_metadata: Record<string, unknown> | null
  /** The address the social provider vouched for. */
  email: string
}

/**
 * The account a social sign-in may join (adr/0037 §3): one with a login
 * for the same address, confirmed by its owner through the e-mail code in
 * that login's own session (`confirmedByOwnLogin`). Both sides have then
 * proven the address; anything less joins nothing.
 */
const findAccountStep = createStep(
  "account-find-linkable",
  async (input: LinkInput, { container }) => {
    const [account] = await container
      .resolve(Modules.CUSTOMER)
      .listCustomers(
        { email: { $ilike: likeLiteral(input.email) }, has_account: true },
        { take: 1, select: ["id", "email", "first_name", "last_name"] }
      )
    if (!account?.email) {
      return new StepResponse(null)
    }
    // The account's own e-mail sign-in confirmed it: a code another
    // identity confirmed for the address does not (security review of
    // PR #73, M1). A social-only account is never joined (no social to social)
    return new StepResponse(
      (await confirmedByOwnLogin(container, account.id))
        ? {
            id: account.id,
            email: account.email,
            first_name: account.first_name ?? null,
            last_name: account.last_name ?? null,
            has_account: true as const,
          }
        : null
    )
  }
)

/** Points the social identity at the account; undone by giving it its old metadata back. */
const linkIdentityStep = createStep(
  "account-link-identity",
  async (input: { link: LinkInput; account: LinkedCustomer | null }, { container }) => {
    if (!input.account) {
      return new StepResponse(null)
    }
    await container.resolve(Modules.AUTH).updateAuthIdentities({
      id: input.link.auth_identity_id,
      app_metadata: { ...input.link.app_metadata, customer_id: input.account.id },
    })
    return new StepResponse(input.account, input.link)
  },
  async (link, { container }) => {
    if (link) {
      await container.resolve(Modules.AUTH).updateAuthIdentities({
        id: link.auth_identity_id,
        app_metadata: link.app_metadata ?? {},
      })
    }
  }
)

/**
 * A first social sign-in with an address that already has a confirmed
 * account joins it instead of opening another; null when none may be joined.
 */
export const linkSocialIdentityWorkflow = createWorkflow(
  "account-link-social-identity",
  (input: LinkInput) => {
    const account = findAccountStep(input)
    return new WorkflowResponse(linkIdentityStep({ link: input, account }))
  }
)
