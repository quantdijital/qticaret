import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { sendMessageWorkflow } from "../../messaging/send-message"
import { accountById } from "./account-rows"

/** How the account's message went: out, or not (no mail server, no storefront address, a failure). */
export type AccountMessageOutcome = "sent" | "not_sent"

const stamp = (value: Date | string | null | undefined) =>
  value ? String(new Date(value).getTime()) : "0"

/**
 * The account's message, last (ADR-0068 §3 step 5): a pending account's
 * invitation to the storefront's sign-up page, an active one's "your
 * wholesale account is open". Each invitation is its own send (a resend
 * sends again). A message that does not go never undoes the account: the
 * panel offers the invitation again.
 */
export const sendAccountMessageStep = createStep(
  "wholesale-account-message",
  async (input: { account_id: string }, { container }) => {
    try {
      const account = await accountById(container, input.account_id)
      const pending = account.status === "pending"
      if (!pending && account.status !== "active") {
        return new StepResponse({ message: "not_sent" as AccountMessageOutcome })
      }
      const { result } = await sendMessageWorkflow(container).run({
        input: pending
          ? {
              template: "account.wholesale_invite",
              resource_id: account.id,
              key: `invite:${stamp(account.invited_at)}`,
            }
          : {
              template: "account.wholesale_enabled",
              resource_id: account.id,
              key: `enabled:${stamp(account.activated_at)}`,
            },
      })
      const email = (result as { email?: string }).email
      const message: AccountMessageOutcome =
        email === "sent" || email === "duplicate" ? "sent" : "not_sent"
      return new StepResponse({ message })
    } catch (error) {
      logger.warn({ event: "wholesale.account_message_failed", err: errorSummary(error) })
      return new StepResponse({ message: "not_sent" as AccountMessageOutcome })
    }
  }
)
