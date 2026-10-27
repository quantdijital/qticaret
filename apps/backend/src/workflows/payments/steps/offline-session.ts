import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import type { Kurus } from "../../../lib/money"
import {
  BANK_TRANSFER_PAYMENT_PROVIDER_ID,
  COD_PAYMENT_PROVIDER_ID,
} from "../../../lib/payments/checkout"
import { bankTransferSettings } from "../../../lib/payments/settings"

/**
 * What an offline way to pay starts its session with (adr/0029): the
 * shop's bank account for a transfer (shown to the shopper), the fee for
 * cash on delivery. Read here, so the providers reach no other module.
 */
export const offlineSessionDataStep = createStep(
  "payments-offline-session-data",
  async (input: { provider_id: string; fee: Kurus }, { container }) => {
    if (input.provider_id === COD_PAYMENT_PROVIDER_ID) {
      return new StepResponse<Record<string, unknown>>({ fee: input.fee })
    }
    if (input.provider_id !== BANK_TRANSFER_PAYMENT_PROVIDER_ID) {
      return new StepResponse<Record<string, unknown>>({})
    }
    const bank = await bankTransferSettings(container)
    if (!bank.enabled || !bank.iban) {
      throw new ValidationError("bank_transfer.not_configured")
    }
    return new StepResponse<Record<string, unknown>>({
      account: {
        account_holder: bank.account_holder,
        bank_name: bank.bank_name,
        iban: bank.iban,
        deadline_hours: bank.deadline_hours,
      },
    })
  }
)
