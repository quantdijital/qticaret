import { Module } from "@medusajs/framework/utils"
import PaymentFormsModuleService from "./service"

/** Hosted forms given out, for the reconcile job (F5 V9). */
export const PAYMENT_FORMS_MODULE = "paymentForms"

export default Module(PAYMENT_FORMS_MODULE, { service: PaymentFormsModuleService })
