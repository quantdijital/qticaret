import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import AppleAuthService from "./service"

/** Sign in with Apple for customers (F10.2, adr/0037 §3). */
export default ModuleProvider(Modules.AUTH, { services: [AppleAuthService] })
