import { container } from "@medusajs/framework"
import { paymentSettings } from "../../lib/payments/settings"
import { iyzicoCredentialsOf } from "../../lib/payments/iyzico"
import type { IyzicoCredentials } from "../../lib/payments/iyzico"
import { INTEGRATION_CREDENTIALS_MODULE } from "../integration-credentials"
import type IntegrationCredentialsModuleService from "../integration-credentials/service"
import { PAYMENT_RECOVERY_MODULE } from "../payment-recovery"
import type PaymentRecoveryModuleService from "../payment-recovery/service"
import type { PaymentSettings } from "../platform-settings/sections"

/**
 * The shop's iyzico account at the time of the call (adr/0027), from the
 * app's shared container, as the PayTR provider reads its own. Null when
 * nothing is stored or it cannot be opened.
 */
export async function storedIyzicoAccount(): Promise<IyzicoCredentials | null> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  return iyzicoCredentialsOf(await credentials.read("iyzico"))
}

/** The shop's installment choices (F5 V6): one setting for every card provider. */
export const storedPaymentSettings = (): Promise<PaymentSettings> => paymentSettings(container)

/** Whether iyzico's payment is recorded to be given back (`payment-recovery`): never an order. */
export async function isRecordedForRefund(paymentId: string): Promise<boolean> {
  const [row] = await container
    .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    .listPaymentRecoveries(
      { provider: "iyzico", reference: paymentId },
      { take: 1, select: ["id"] }
    )
  return row !== undefined
}
