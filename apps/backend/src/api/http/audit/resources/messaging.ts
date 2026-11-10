import { MESSAGING_MODULE } from "../../../../modules/messaging"
import type MessagingModuleService from "../../../../modules/messaging/service"
import type { AuditedResource } from "../types"

/**
 * A customer message's words and switch (adr/0036 Ek 2026-11-10): each
 * field before and after, so the log says who reworded or turned off
 * which message. The texts are the shop's own, written for every customer.
 */
export const MESSAGING_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/messaging/customer-messages/:name",
    pattern: /^\/admin\/messaging\/customer-messages\/(?<name>[a-z_.]+)$/i,
    resourceType: "message_template",
    resourceId: (params) => params["name"] ?? null,
    snapshot: async ({ scope, params }) => {
      const service = scope.resolve(MESSAGING_MODULE) as MessagingModuleService
      const row = await service.templateTextOf(params["name"] ?? "")
      return row
        ? {
            enabled: row.enabled,
            subject: row.subject,
            preheader: row.preheader,
            heading: row.heading,
            intro: row.intro,
            sms: row.sms,
          }
        : {}
    },
  },
]
