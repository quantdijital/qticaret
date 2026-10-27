import { Module } from "@medusajs/framework/utils"
import PaymentRecoveryModuleService from "./service"

/** Payments that became no order, given back by the recovery job (adr/0026 §6). */
export const PAYMENT_RECOVERY_MODULE = "paymentRecovery"

export default Module(PAYMENT_RECOVERY_MODULE, { service: PaymentRecoveryModuleService })
