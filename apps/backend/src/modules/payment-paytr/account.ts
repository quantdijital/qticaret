import { container } from "@medusajs/framework"
import { paymentSettings } from "../../lib/payments/settings"
import { paytrCredentialsOf } from "../../lib/payments/paytr"
import type { PaytrCredentials } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../integration-credentials"
import type IntegrationCredentialsModuleService from "../integration-credentials/service"
import { PAYMENT_RECOVERY_MODULE } from "../payment-recovery"
import type PaymentRecoveryModuleService from "../payment-recovery/service"
import { GIVEN_BACK } from "../payment-recovery/service"
import type { PaymentSettings } from "../platform-settings/sections"

/**
 * The shop's PayTR account at the time of the call (adr/0027). A provider
 * sees only its module's container; the account comes from the app's
 * shared one, resolved per call: providers are built before the modules
 * are registered there. Null when nothing is stored or it cannot be opened.
 */
export async function storedPaytrAccount(): Promise<PaytrCredentials | null> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  return paytrCredentialsOf(await credentials.read("paytr"))
}

/**
 * Whether PayTR's payment is recorded to be given back (`payment-recovery`),
 * as iyzico's provider asks (security review 2026-11-16): never an order,
 * however its cart is completed, so the recovery job never refunds an order
 * placed meanwhile. One found to be a placed order's (`order_exists`) is not.
 */
export async function isRecordedForRefund(merchantOid: string): Promise<boolean> {
  const [row] = await container
    .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    .listPaymentRecoveries(
      { provider: "paytr", reference: merchantOid, status: [...GIVEN_BACK] },
      { take: 1, select: ["id"] }
    )
  return row !== undefined
}

/**
 * The reference the recovery job gives PayTR's payment back under, when it
 * is recorded (`payment-recovery`), whatever became of it: Medusa's own
 * refund of the same amount finds it in PayTR's record and is not made a
 * second time.
 */
export async function recoveryRefundReference(merchantOid: string): Promise<string | null> {
  const [row] = await container
    .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    .listPaymentRecoveries(
      { provider: "paytr", reference: merchantOid },
      { take: 1, select: ["refund_reference"] }
    )
  return row?.refund_reference ?? null
}

/** The shop's installment choices (F5 V6), read at the time of the call like the account. */
export const storedPaymentSettings = (): Promise<PaymentSettings> => paymentSettings(container)
