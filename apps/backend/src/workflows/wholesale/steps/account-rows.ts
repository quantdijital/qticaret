import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, uniqueViolationKeys } from "../../../lib/errors"
import { allows } from "../../../lib/wholesale"
import type { AccountAction, AccountStatus } from "../../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import type WholesaleModuleService from "../../../modules/wholesale/service"

/**
 * A wholesaler's account record (ADR-0068 §1, §3), written step by step,
 * each step undone if a later one fails.
 */

export const wholesale = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)

export type AccountRecord = Awaited<ReturnType<WholesaleModuleService["retrieveWholesaleAccount"]>>

/** The account of that id, or 404 as one never made. */
export async function accountById(
  container: Pick<MedusaContainer, "resolve">,
  id: string
): Promise<AccountRecord> {
  const [account] = await wholesale(container).listWholesaleAccounts({ id }, { take: 1 })
  if (!account) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "wholesale.account_unknown")
  }
  return account
}

// The state each action needs, named in its refusal
const ACTION_STATE: Record<AccountAction, string> = {
  deactivate: "active",
  reactivate: "inactive",
  delete: "pending",
  password: "active",
}

/** The account is in a state that allows the action, or 409 says it is not. */
export const checkAccountStep = createStep(
  "wholesale-check-account",
  async (input: { id: string; action: AccountAction }, { container }) => {
    const account = await accountById(container, input.id)
    if (!allows(input.action, account.status)) {
      throw new ConflictError(`wholesale.account_not_${ACTION_STATE[input.action]}`)
    }
    return new StepResponse({
      id: account.id,
      customer_id: account.customer_id ?? null,
      private_group_id: account.private_group_id ?? null,
      private_price_list_id: account.private_price_list_id ?? null,
    })
  }
)

/** One address, one account: a second save of the same address answers as the check would. */
function emailTaken(error: unknown): never {
  const keys = uniqueViolationKeys(error)
  if (keys?.includes("email") || keys?.includes("customer_id")) {
    throw new ConflictError("wholesale.exists")
  }
  throw error
}

export interface AccountRowInput {
  email: string
  company_name: string | null
  contact_name: string | null
  tier_id: string | null
  rate_bps: number | null
  min_quantity: number | null
  /** Null: no invitation goes out any more (Ek 2026-11-15 (2)). */
  invited_at: Date | null
  /** The sign-in is one staff made or took over (review M4). */
  staff_login: boolean
  created_by: string | null
}

/** The account, pending until a customer is bound to it; undone by removing it. */
export const createAccountRowStep = createStep(
  "wholesale-create-account-row",
  async (input: AccountRowInput, { container }) => {
    const account = await wholesale(container)
      .createWholesaleAccounts({
        ...input,
        status: "pending",
        updated_by: input.created_by,
        // A rate prices every variant: the sync job writes the own list's rows
        sync_requested_at: input.rate_bps === null ? null : new Date(),
      })
      .catch(emailTaken)
    return new StepResponse({ id: account.id }, account.id)
  },
  async (id, { container }) => {
    if (id) {
      await wholesale(container).deleteWholesaleAccounts([id])
    }
  }
)

/** What an account's fields may be changed to; the ids of Medusa's records are the module's own. */
export interface AccountPatch {
  status?: AccountStatus
  customer_id?: string | null
  email?: string | null
  company_name?: string | null
  contact_name?: string | null
  tier_id?: string | null
  rate_bps?: number | null
  min_quantity?: number | null
  private_group_id?: string | null
  private_price_list_id?: string | null
  invited_at?: Date | null
  activated_at?: Date | null
  deactivated_at?: Date | null
  sync_requested_at?: Date | null
  updated_by?: string | null
}

type Before = AccountPatch & { id: string }

/** Some of an account's fields changed; undone by putting those fields back. */
export const patchAccountStep = createStep(
  "wholesale-patch-account",
  async (input: { id: string; patch: AccountPatch }, { container }) => {
    const service = wholesale(container)
    const account = await accountById(container, input.id)
    const keys = Object.keys(input.patch) as (keyof AccountPatch)[]
    const stored = account as unknown as Record<string, unknown>
    const before = Object.fromEntries([
      ["id", account.id],
      ...keys.map((key) => [key, stored[key] ?? null]),
    ]) as Before
    if (keys.length > 0) {
      await service.updateWholesaleAccounts({ id: account.id, ...input.patch }).catch(emailTaken)
    }
    return new StepResponse({ id: account.id }, before)
  },
  async (before, { container }) => {
    if (before && Object.keys(before).length > 1) {
      await wholesale(container).updateWholesaleAccounts(before)
    }
  }
)

/**
 * The account gone for good (a pending one taken back or past its 90
 * days): what named a person (address, company, contact) cleared, the
 * row soft-deleted so its Medusa ids still tell the price events apart.
 * The workflow's last step: nothing after it to undo it for.
 */
export const removeAccountRowStep = createStep(
  "wholesale-remove-account-row",
  async (input: { id: string }, { container }) => {
    const service = wholesale(container)
    await service.updateWholesaleAccounts({
      id: input.id,
      email: null,
      company_name: null,
      contact_name: null,
    })
    await service.softDeleteWholesaleAccounts([input.id])
    return new StepResponse({ id: input.id })
  }
)
