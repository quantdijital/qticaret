import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SmsNotificationService from "./service"

/** SMS (adr/0036): the `sms` channel of Medusa's notification module, on the shop's Netgsm account. */
export default ModuleProvider(Modules.NOTIFICATION, { services: [SmsNotificationService] })
