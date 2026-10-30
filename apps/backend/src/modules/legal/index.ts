import { Module } from "@medusajs/framework/utils"
import LegalModuleService from "./service"

/** The shop's legal texts, their versions and the consents given to them (F13, adr/0041). */
export const LEGAL_MODULE = "legal"

export default Module(LEGAL_MODULE, { service: LegalModuleService })
