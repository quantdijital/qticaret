import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import EmailNotificationService from "./service"

/** E-mail (adr/0036): the `email` channel of Medusa's notification module. */
export default ModuleProvider(Modules.NOTIFICATION, { services: [EmailNotificationService] })
