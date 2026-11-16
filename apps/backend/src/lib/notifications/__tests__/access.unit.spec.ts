import { STAFF_ROLES } from "../../staff/permissions"
import { ALERT_ACCESS, hiddenTriggers } from "../access"
import { ALERT_GROUPS, WHOLESALE_ORDER_TRIGGER } from "../feed"
import type { AlertGroup } from "../feed"

/**
 * One kind per group, as the writers set them: what each role's bell, page
 * and marks leave out. `null`: every role gets it.
 */
const KINDS: Record<AlertGroup, Record<string, "owner" | "owner_admin" | null>> = {
  orders: {
    "orders.new_order": null,
    "orders.bank_transfer_pending": null,
    "orders.fraud_review": null,
    "orders.stock_short": null,
    "returns.refund_deadline_near": null,
  },
  wholesale: { [WHOLESALE_ORDER_TRIGGER]: "owner_admin" },
  payments: {
    // A paid cart's trouble stays everyone's (it is about an order)
    "payments.completion_stuck": null,
    "payments.refunded_before_order": null,
    "payments.statement_mismatch": "owner_admin",
    "payment_links.paid": null,
  },
  stock: { "stock.low": null },
  invoices: {
    "einvoice.issue_stopped": null,
    "einvoice.return_needed": null,
    "accounting.sync_stopped": "owner_admin",
  },
  messages: {
    "contact_message.received": null,
    "messaging.smtp_rejections": null,
    "campaigns.paused_complaints": null,
  },
  system: {
    "integration_credentials.changed": "owner_admin",
    "webhooks.disabled": "owner_admin",
    // The move from the old platform is the owner's alone (OWNER_ONLY)
    "migration.not_found_seen": "owner",
  },
}

const sees = (who: "owner" | "owner_admin" | null, role: string) =>
  who === null || role === "owner" || (who === "owner_admin" && role === "admin")

describe("which roles get which alerts (adr/0020, adr/0040)", () => {
  it("names every closed kind in one group or another", () => {
    const listed = Object.values(KINDS).flatMap((kinds) => Object.keys(kinds))
    for (const trigger of Object.keys(ALERT_ACCESS)) {
      expect(listed).toContain(trigger)
    }
  })

  it.each(STAFF_ROLES.flatMap((role) => Object.keys(KINDS).map((group) => [role, group])))(
    "%s × %s",
    (role, group) => {
      const hidden = hiddenTriggers(role as (typeof STAFF_ROLES)[number])
      const kinds = KINDS[group as AlertGroup]
      for (const [trigger, who] of Object.entries(kinds)) {
        // Each kind is in the group the page filters it under
        expect(ALERT_GROUPS[group as AlertGroup].some((prefix) => trigger.startsWith(prefix))).toBe(
          true
        )
        expect([trigger, hidden.includes(trigger)]).toEqual([trigger, !sees(who, role)])
      }
    }
  )

  it("leaves operations and read-only staff payment trouble and customers' messages", () => {
    for (const role of ["operations", "readonly"] as const) {
      expect(hiddenTriggers(role).sort()).toEqual(
        [
          "accounting.sync_stopped",
          "integration_credentials.changed",
          "migration.not_found_seen",
          "payments.statement_mismatch",
          "webhooks.disabled",
          WHOLESALE_ORDER_TRIGGER,
        ].sort()
      )
    }
    expect(hiddenTriggers("owner")).toEqual([])
    expect(hiddenTriggers("admin")).toEqual(["migration.not_found_seen"])
  })
})
